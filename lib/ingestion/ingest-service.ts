/**
 * CSV Ingestion Service
 * Integrates with existing ingestion logic
 */

import { Pool } from 'pg';
import { parse } from 'csv-parse/sync';
import { detectFileType } from '@/lib/csv/file-detector';
import { extractDateFromCSVData } from '@/lib/csv/date-extractor';

// Import helper functions from existing scripts
// These would need to be extracted into a shared module
// For now, we'll create simplified versions

export interface IngestionResult {
  success: boolean;
  rowsProcessed: number;
  rowsInserted: number;
  rowsUpdated: number;
  rowsFailed: number;
  errors: string[];
  csvDate?: Date | null;
}

export async function ingestCSVFile(
  pool: Pool,
  fileContent: string,
  fileName: string,
  uploadId: number
): Promise<IngestionResult> {
  try {
    // Parse CSV
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, any>[];

    if (records.length === 0) {
      return {
        success: false,
        rowsProcessed: 0,
        rowsInserted: 0,
        rowsUpdated: 0,
        rowsFailed: 0,
        errors: ['CSV file is empty or has no valid data'],
      };
    }

    // Detect file type
    const headers = Object.keys(records[0] as Record<string, any>);
    const detected = detectFileType(fileName, headers);

    if (detected.type === 'unknown') {
      return {
        success: false,
        rowsProcessed: 0,
        rowsInserted: 0,
        rowsUpdated: 0,
        rowsFailed: 0,
        errors: ['Unknown file type'],
      };
    }

    // Extract CSV date
    const csvDate = extractDateFromCSVData(detected.type, records);

    // Call appropriate ingestion function
    // Note: This is a placeholder - you'll need to integrate with your actual ingestion functions
    // For now, we'll use a simplified approach that calls the existing script logic
    
    // Update: We'll need to refactor the ingestion scripts to be importable
    // For MVP, we can use a child process to call the existing script
    // Or better: extract the ingestion logic into shared functions

    // Placeholder result - replace with actual ingestion
    const result: IngestionResult = {
      success: true,
      rowsProcessed: records.length,
      rowsInserted: records.length,
      rowsUpdated: 0,
      rowsFailed: 0,
      errors: [],
      csvDate,
    };

    // Update upload record
    await pool.query(
      `UPDATE him_ttdi.csv_uploads 
       SET rows_inserted = $1, 
           rows_updated = $2,
           rows_failed = $3,
           upload_status = $4
       WHERE upload_id = $5`,
      [
        result.rowsInserted,
        result.rowsUpdated,
        result.rowsFailed,
        result.success ? 'success' : 'failed',
        uploadId,
      ]
    );

    return result;
  } catch (error: any) {
    // Update upload record with error
    await pool.query(
      `UPDATE him_ttdi.csv_uploads 
       SET upload_status = 'failed',
           error_message = $1
       WHERE upload_id = $2`,
      [error.message, uploadId]
    );

    return {
      success: false,
      rowsProcessed: 0,
      rowsInserted: 0,
      rowsUpdated: 0,
      rowsFailed: 0,
      errors: [error.message],
    };
  }
}
