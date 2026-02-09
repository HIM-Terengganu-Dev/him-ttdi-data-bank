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
import { processUpload } from '@/lib/ingestion/process-upload';

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

        // Simple detection based on filename for Device Export, else parse headers
        if (file.name.toLowerCase().startsWith('device_')) {
          detected = { type: 'leads_device_export', tableName: 'leads', displayName: 'Device Export' };
          // We don't parse content here if we don't need to. processUpload will parse.
        } else {
          // Parse CSV headers
          const fileContent = buffer.toString('utf-8');
          records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            relax_column_count: true,
          });
          const headers = Object.keys(records[0] || {});
          detected = detectFileType(file.name, headers);
        }

        // Get tags and sources for this specific file
        const fileMetadata = metadata[file.name] || { tagIds: [], sourceIds: [] };

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
           VALUES ($1, 'leads', 0, 'queued', NOW(), $2)
           RETURNING upload_id`,
          [file.name, JSON.stringify(fileMetadata)]
        );

        const uploadId = uploadResult.rows[0].upload_id;

        // Save file with upload_id in filename
        const tempFilePath = path.join(uploadsDir, `${uploadId}_${file.name}`);
        fs.writeFileSync(tempFilePath, buffer); // Note: processUpload expects file on disk

        // Update with file path
        await pool.query(
          `UPDATE him_ttdi.csv_uploads 
           SET file_path = $1
           WHERE upload_id = $2`,
          [tempFilePath, uploadId]
        );

        console.log(`[Upload] File queued: ${tempFilePath} (ID: ${uploadId})`);

        // Trigger Async Processing
        processUpload(uploadId).catch((error) => {
          console.error(`[Upload] Background processing failed for ${uploadId}:`, error);
        });

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
