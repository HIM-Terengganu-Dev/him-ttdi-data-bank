/**
 * Process a single queued upload
 * Can be called from API route or script
 */

import { Pool } from 'pg';
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
import { ingestWabotBlastData } from './wabot-ingestion';

/**
 * Process upload directly from records (for serverless environments)
 * This avoids file I/O issues in serverless
 */
export async function processUploadDirect(
  uploadId: number,
  records: Record<string, any>[],
  fileType: string,
  tagIds: number[] = [],
  sourceIds: number[] = []
): Promise<void> {
  const pool = getPool();

  try {
    // Get upload record
    const uploadResult = await pool.query(
      `SELECT upload_id, file_name, table_name
       FROM him_ttdi.csv_uploads
       WHERE upload_id = $1 AND upload_status = 'queued'`,
      [uploadId]
    );

    if (uploadResult.rows.length === 0) {
      throw new Error(`Upload ${uploadId} not found or not queued`);
    }

    const upload = uploadResult.rows[0];
    const { file_name } = upload;

    console.log(`[Process] Processing: ${file_name} (ID: ${uploadId})`);

    // Update status to processing
    await pool.query(
      `UPDATE him_ttdi.csv_uploads 
       SET upload_status = 'processing'
       WHERE upload_id = $1`,
      [uploadId]
    );

    if (records.length === 0) {
      throw new Error('File is empty or has no valid data');
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
      case 'leads_device_export':
        result = await ingestWsapmeLeads(pool, records, uploadId, tagIds, sourceIds);
        break;
      case 'wabot_blast':
        result = await ingestWabotBlastData(pool, records);
        break;
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }

    // Calculate total processed: inserted + updated + failed + skipped
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
        totalProcessed,
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

/**
 * Process a micro-batch chunk of an upload without marking it complete.
 * This incrementally updates the rows_inserted, rows_updated, and rows_processed counts.
 */
export async function processUploadChunk(
  uploadId: number,
  records: Record<string, any>[],
  fileType: string,
  tagIds: number[] = [],
  sourceIds: number[] = []
): Promise<{ inserted: number; updated: number; failed: number; processed: number }> {
  const pool = getPool();

  if (records.length === 0) return { inserted: 0, updated: 0, failed: 0, processed: 0 };

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
    case 'leads_device_export':
      result = await ingestWsapmeLeads(pool, records, uploadId, tagIds, sourceIds);
      break;
    case 'wabot_blast':
      result = await ingestWabotBlastData(pool, records);
      break;
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }

  const totalProcessed = result.inserted + result.updated + result.failed + (result.skipped || 0);

  // Incrementally update upload record counts
  await pool.query(
    `UPDATE him_ttdi.csv_uploads 
     SET rows_inserted = COALESCE(rows_inserted, 0) + $1,
         rows_updated = COALESCE(rows_updated, 0) + $2,
         rows_failed = COALESCE(rows_failed, 0) + $3,
         rows_processed = COALESCE(rows_processed, 0) + $4
     WHERE upload_id = $5`,
    [result.inserted, result.updated, result.failed, totalProcessed, uploadId]
  );

  return {
    inserted: result.inserted,
    updated: result.updated,
    failed: result.failed,
    processed: totalProcessed,
  };
}
