/**
 * Leads Upload API Route
 * Handles leads file uploads with tag and source selection
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db/client';
import { detectFileType } from '@/lib/csv/file-detector';
import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';
import { processUploadDirect } from '@/lib/ingestion/process-upload';
import { readExcelHeaders } from '@/lib/excel/parser';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const metadataJson = formData.get('metadata') as string;

    // Parse metadata
    const metadata: Record<string, { tagIds: number[], sourceIds: number[] }> = metadataJson ? JSON.parse(metadataJson) : {};

    const results = [];

    for (const file of files) {
      try {
        // Read file content
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Use raw parsing/detection logic similar to previous implementation but we need to pass records/content to processUpload?
        // Actually processUpload reads from disk. We just need to save it.
        // But we need to detect type first to set 'table_name' in csv_uploads ('leads').

        // Detect file type
        let detected;
        let records;

        // Special handling for Excel-like files or large CSVs?
        // For detection, we can just peek headers or filename.
        // LeadsUpload.tsx already detects it client side, but we should verify.

        // Check if it's an Excel file
        const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
        
        // Simple detection based on filename for Device Export, else parse headers
        if (file.name.toLowerCase().startsWith('device_')) {
          detected = { type: 'leads_device_export', tableName: 'leads_wsapme', displayName: 'Device Export' };
          // We don't parse content here if we don't need to. processUpload will parse.
        } else if (isExcel) {
          // Parse Excel headers
          const headers = readExcelHeaders(buffer);
          detected = detectFileType(file.name, headers);
        } else {
          // Parse CSV headers
          const fileContent = buffer.toString('utf-8');
          records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            relax_column_count: true,
          }) as Record<string, any>[];
          const headers = Object.keys((records[0] as Record<string, any>) || {});
          detected = detectFileType(file.name, headers);
        }

        // Get tags and sources for this specific file
        const fileMetadata = metadata[file.name] || { tagIds: [], sourceIds: [] };

        // Determine the specific table name based on detected type
        let tableName = 'leads';
        if (detected.type === 'leads_tiktok_beg_biru') {
          tableName = 'leads_tiktok_beg_biru';
        } else if (detected.type === 'leads_wsapme' || detected.type === 'leads_device_export') {
          tableName = 'leads_wsapme';
        }

        // Save file to temporary location
        const uploadsDir = path.join(process.cwd(), 'data-files', 'leads', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Create upload record
        const pool = getPool();
        const uploadResult = await pool.query(
          `INSERT INTO him_ttdi.csv_uploads 
           (file_name, table_name, rows_processed, upload_status, uploaded_at, metadata)
           VALUES ($1, $2, 0, 'queued', NOW(), $3)
           RETURNING upload_id`,
          [file.name, tableName, JSON.stringify(fileMetadata)]
        );

        const uploadId = uploadResult.rows[0].upload_id;

        // Process the file directly from memory (better for serverless)
        // Parse the file content here since we already have it in memory
        let recordsToProcess: Record<string, any>[];
        const isExcelFile = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
        
        if (isExcelFile) {
          const { parseExcelFile } = await import('@/lib/excel/parser');
          const excelResult = parseExcelFile(buffer);
          recordsToProcess = excelResult.records;
        } else {
          recordsToProcess = records || parse(buffer.toString('utf-8'), {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            relax_column_count: true,
          }) as Record<string, any>[];
        }

        // Process synchronously to ensure completion in serverless environment
        try {
          await processUploadDirect(uploadId, recordsToProcess, detected.type, fileMetadata.tagIds, fileMetadata.sourceIds);
        } catch (error: any) {
          console.error(`[Upload] Processing failed for ${uploadId}:`, error);
          // Status will be updated to 'failed' by processUploadDirect
        }

        results.push({
          fileName: file.name,
          success: true,
          status: 'queued',
          message: 'File queued for background processing'
        });

      } catch (error: any) {
        console.error(`Error processing file ${file.name}:`, error);
        results.push({
          fileName: file.name,
          success: false,
          error: error.message || 'Unknown error',
        });
      }
    }

    return NextResponse.json({ results, success: true });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process upload' },
      { status: 500 }
    );
  }
}
