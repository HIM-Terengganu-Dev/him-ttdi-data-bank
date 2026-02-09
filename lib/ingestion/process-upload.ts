/**
 * Process a single queued upload
 * Can be called from API route or script
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import { getPool } from '@/lib/db/client';
import {
  ingestPatientDetails,
  ingestConsultations,
  ingestProcedurePrescriptions,
  ingestMedicinePrescriptions,
  ingestInvoices,
  ingestItemizedSales,
  ingestDailyDoctorSales,
} from './ingestion-functions';
import {
  ingestTikTokBegBiruLeads,
  ingestWsapmeLeads,
} from './leads-ingestion';

export async function processUpload(uploadId: number): Promise<void> {
  const pool = getPool();

  try {
    // Get upload record
    const uploadResult = await pool.query(
      `SELECT upload_id, file_name, file_path, table_name, rows_processed, metadata
       FROM him_ttdi.csv_uploads
       WHERE upload_id = $1 AND upload_status = 'queued'`,
      [uploadId]
    );

    if (uploadResult.rows.length === 0) {
      throw new Error(`Upload ${uploadId} not found or not queued`);
    }

    const upload = uploadResult.rows[0];
    const { file_name, file_path, table_name, metadata } = upload;

    // Extract metadata
    const { tagIds = [], sourceIds = [] } = metadata || {};

    console.log(`[Process] Processing: ${file_name} (ID: ${uploadId})`);

    // Update status to processing
    await pool.query(
      `UPDATE him_ttdi.csv_uploads 
       SET upload_status = 'processing'
       WHERE upload_id = $1`,
      [uploadId]
    );

    // Check if file exists
    if (!fs.existsSync(file_path)) {
      throw new Error(`File not found: ${file_path}`);
    }

    // Read and parse CSV
    const fileContent = fs.readFileSync(file_path, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, any>[];

    if (records.length === 0) {
      throw new Error('CSV file is empty or has no valid data');
    }

    // Determine file type from table_name
    let fileType: string;
    switch (table_name) {
      case 'patients':
        fileType = 'patient_details';
        break;
      case 'consultations':
        fileType = 'consultation';
        break;
      case 'procedure_prescriptions':
        fileType = 'procedure_prescription';
        break;
      case 'medicine_prescriptions':
        fileType = 'medicine_prescription';
        break;
      case 'invoices':
        fileType = 'invoice';
        break;
      case 'itemized_sales':
        fileType = 'itemized_sales';
        break;
      case 'daily_doctor_sales':
        fileType = 'daily_doctor_sales';
        break;
      case 'leads':
        // Need to determine if it's TikTok Beg Biru or Wsapme or Device Export
        // Check headers/filename to determine
        // Since we don't have filename here in logic easily (we do have file_name var), check based on content or extension/name pattern if passed.

        // Actually we do have file_name.
        if (file_name.toLowerCase().startsWith('device_')) {
          fileType = 'leads_device_export';
        } else {
          const headers = Object.keys((records[0] as Record<string, any>) || {});
          const headersUpper = headers.map((h) => h.toUpperCase());
          if (headersUpper.includes('LEAD ID') && headersUpper.includes('USERNAME')) {
            fileType = 'leads_tiktok_beg_biru';
          } else {
            fileType = 'leads_wsapme';
          }
        }
        break;
      default:
        throw new Error(`Unknown table name: ${table_name}`);
    }

    // Process based on file type
    let result;
    switch (fileType) {
      case 'patient_details':
        result = await ingestPatientDetails(pool, records);
        break;
      case 'consultation':
        result = await ingestConsultations(pool, records);
        break;
      case 'procedure_prescription':
        result = await ingestProcedurePrescriptions(pool, records);
        break;
      case 'medicine_prescription':
        result = await ingestMedicinePrescriptions(pool, records);
        break;
      case 'invoice':
        result = await ingestInvoices(pool, records);
        break;
      case 'itemized_sales':
        result = await ingestItemizedSales(pool, records);
        break;
      case 'daily_doctor_sales':
        result = await ingestDailyDoctorSales(pool, records);
        break;
      case 'leads_tiktok_beg_biru':
        result = await ingestTikTokBegBiruLeads(pool, records, uploadId, tagIds, sourceIds);
        break;
      case 'leads_wsapme':
        result = await ingestWsapmeLeads(pool, records, uploadId, tagIds, sourceIds);
        break;
      case 'leads_device_export':
        // Device export files are treated as Wsapme format (variable headers, requires source)
        result = await ingestWsapmeLeads(pool, records, uploadId, [], []);
        break;
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }

    // Calculate total processed: inserted + updated + failed + skipped
    // This ensures rows_processed = sum of all outcomes
    const totalProcessed = result.inserted + result.updated + result.failed + (result.skipped || 0);

    // Update upload record with accurate counts
    await pool.query(
      `UPDATE him_ttdi.csv_uploads 
       SET upload_status = 'success',
           rows_inserted = $1,
           rows_updated = $2,
           rows_failed = $3,
           rows_processed = $4
       WHERE upload_id = $5`,
      [
        result.inserted,
        result.updated,
        result.failed,
        totalProcessed, // Use calculated total instead of records.length
        uploadId
      ]
    );

    console.log(`[Process] ✅ Success: ${result.inserted} inserted, ${result.updated} updated, ${result.failed} failed`);

  } catch (error: any) {
    console.error(`[Process] ❌ Error processing upload ${uploadId}:`, error.message);

    // Update upload record with error
    await pool.query(
      `UPDATE him_ttdi.csv_uploads 
       SET upload_status = 'failed',
           error_message = $1
       WHERE upload_id = $2`,
      [error.message || 'Processing failed', uploadId]
    );

    throw error;
  }
}
