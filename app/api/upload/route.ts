/**
 * CSV Upload API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db/client';
import { detectFileType } from '@/lib/csv/file-detector';
import { extractDateFromCSVData } from '@/lib/csv/date-extractor';
import { parse } from 'csv-parse/sync';
// Removed fs and path imports - no longer saving files to disk
// No longer importing processUpload - using processUploadDirect instead

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    const results = [];

    for (const file of files) {
      try {
        // Read file content
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileContent = buffer.toString('utf-8');

        // Parse CSV to get headers first
        const records = parse(fileContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        }) as Record<string, any>[];

        if (records.length === 0) {
          results.push({
            fileName: file.name,
            success: false,
            error: 'CSV file is empty or has no valid data',
          });
          continue;
        }

        // Detect file type based on content (headers) - primary method
        const headers = Object.keys(records[0] as Record<string, any>);
        const detected = detectFileType(file.name, headers);

        if (detected.type === 'unknown') {
          results.push({
            fileName: file.name,
            success: false,
            error: 'Unknown file type. Please ensure this is a valid Remedii CSV file.',
          });
          continue;
        }

        // Extract date from CSV data
        const csvDate = extractDateFromCSVData(detected.type, records);

        // Log upload start
        const pool = getPool();
        let uploadId: number | null = null;
        
        try {
          // Create upload record first to get upload_id
          const uploadResult = await pool.query(
            `INSERT INTO him_ttdi.csv_uploads 
             (file_name, table_name, rows_processed, upload_status, uploaded_at)
             VALUES ($1, $2, $3, 'queued', NOW())
             RETURNING upload_id`,
            [file.name, detected.tableName, records.length]
          );

          uploadId = uploadResult.rows[0].upload_id;
          
          console.log(`[Upload] Processing file: ${file.name} (ID: ${uploadId})`);
          
          // Process synchronously from memory (better for serverless)
          if (uploadId !== null) {
            const { processUploadDirect } = await import('@/lib/ingestion/process-upload');
            try {
              await processUploadDirect(uploadId, records, detected.type, [], []);
            } catch (error: any) {
              console.error(`[Upload] Processing failed for ${uploadId}:`, error);
              // Status will be updated to 'failed' by processUploadDirect
            }
          }
          
        } catch (logError: any) {
          console.error(`[Upload] Failed to log upload for ${file.name}:`, logError);
          throw logError;
        }

        results.push({
          fileName: file.name,
          fileType: detected.displayName,
          tableName: detected.tableName,
          success: true,
          rowsProcessed: records.length,
          status: 'processing',
          message: 'File uploaded and processing started in background.',
          csvDate: csvDate ? csvDate.toISOString() : null,
          uploadId,
        });
      } catch (error: any) {
        console.error(`[Upload] Error processing ${file.name}:`, error);
        
        // Try to log the error to csv_uploads if we have a pool connection
        try {
          const pool = getPool();
          await pool.query(
            `INSERT INTO him_ttdi.csv_uploads 
             (file_name, table_name, rows_processed, upload_status, error_message, uploaded_at)
             VALUES ($1, 'unknown', 0, 'failed', $2, NOW())`,
            [file.name, error.message || 'Unknown error occurred']
          );
        } catch (logError: any) {
          console.error(`[Upload] Failed to log error for ${file.name}:`, logError);
        }
        
        results.push({
          fileName: file.name,
          success: false,
          error: error.message || 'Unknown error occurred',
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process upload' },
      { status: 500 }
    );
  }
}
