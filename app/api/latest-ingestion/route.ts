/**
 * Get Latest Ingestion Report API Route
 */

import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db/client';
import { getRemediiFileTypes } from '@/lib/csv/file-detector';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all'; // 'remedi', 'leads', or 'all'
    
    const pool = getPool();
    // Get all file types
    const allFileTypes = getRemediiFileTypes();
    
    // Filter file types based on request
    let fileTypes;
    if (filter === 'remedi') {
      // Only Remedii file types (exclude leads)
      fileTypes = allFileTypes.filter(
        (ft) => ft.type !== 'leads_tiktok_beg_biru' && ft.type !== 'leads_wsapme'
      );
    } else if (filter === 'leads') {
      // For leads, show separate reports for TikTok Beg Biru and Wsapme
      fileTypes = [
        { type: 'leads_tiktok_beg_biru' as const, displayName: 'Leads - TikTok Beg Biru', tableName: 'leads_tiktok_beg_biru' },
        { type: 'leads_wsapme' as const, displayName: 'Leads - Wsapme', tableName: 'leads_wsapme' }
      ];
    } else {
      // All file types
      fileTypes = allFileTypes;
    }

    // Get latest ingestion for each file type
    const latestIngestions = await Promise.all(
      fileTypes.map(async (fileType) => {
        // Find latest upload for this table (including processing/queued status)
        // PostgreSQL TIMESTAMP columns store in UTC, but we need to ensure proper conversion
        const result = await pool.query(
          `SELECT 
            upload_id,
            file_name,
            table_name,
            rows_processed,
            rows_inserted,
            rows_updated,
            rows_failed,
            upload_status,
            uploaded_at,
            error_message
          FROM him_ttdi.csv_uploads
          WHERE table_name = $1
          ORDER BY uploaded_at DESC
          LIMIT 1`,
          [fileType.tableName]
        );

        if (result.rows.length === 0) {
          return {
            fileType: fileType.displayName,
            tableName: fileType.tableName,
            hasData: false,
          };
        }

        const upload = result.rows[0];

        // Try to get CSV date from the most recent data in the table
        // This is a simplified approach - you might want to store CSV date in csv_uploads table
        let csvDate: Date | null = null;
        
        try {
          const dateQuery = getDateQueryForTable(fileType.tableName);
          if (dateQuery) {
            const dateResult = await pool.query(dateQuery);
            if (dateResult.rows.length > 0 && dateResult.rows[0].max_date) {
              csvDate = dateResult.rows[0].max_date;
            }
          }
        } catch (err) {
          // Ignore date extraction errors
        }

        // Convert timestamp to ISO string to ensure proper timezone handling
        // PostgreSQL TIMESTAMP columns are stored without timezone, but interpreted in server timezone
        // We need to explicitly convert to UTC for proper client-side timezone conversion
        let uploadedAt: string | null = null;
        if (upload.uploaded_at) {
          // If it's a Date object, convert directly
          if (upload.uploaded_at instanceof Date) {
            uploadedAt = upload.uploaded_at.toISOString();
          } else {
            // If it's a string, parse it
            // PostgreSQL returns timestamps as strings, we need to ensure they're treated as UTC
            let dateStr = String(upload.uploaded_at);
            // If the string doesn't have timezone info, assume it's in UTC
            if (!dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.match(/-\d{2}:\d{2}$/)) {
              // Check if it ends with timezone offset pattern
              if (!dateStr.match(/[+-]\d{2}:\d{2}$/)) {
                dateStr = dateStr + 'Z'; // Add Z to indicate UTC
              }
            }
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              uploadedAt = date.toISOString();
            }
          }
        }

        return {
          fileType: fileType.displayName,
          tableName: fileType.tableName,
          hasData: true,
          fileName: upload.file_name,
          uploadedAt: uploadedAt,
          csvDate: csvDate ? (csvDate instanceof Date ? csvDate.toISOString() : new Date(csvDate).toISOString()) : null,
          rowsProcessed: upload.rows_processed,
          rowsInserted: upload.rows_inserted,
          rowsUpdated: upload.rows_updated,
          rowsFailed: upload.rows_failed,
          uploadStatus: upload.upload_status,
        };
      })
    );

    return NextResponse.json({
      success: true,
      ingestions: latestIngestions,
    });
  } catch (error: any) {
    console.error('Error fetching latest ingestion:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch latest ingestion' },
      { status: 500 }
    );
  }
}

function getDateQueryForTable(tableName: string): string | null {
  switch (tableName) {
    case 'patients':
      return `SELECT MAX(first_visit_date) as max_date FROM him_ttdi.patients WHERE first_visit_date IS NOT NULL`;
    case 'consultations':
      return `SELECT MAX(visit_date) as max_date FROM him_ttdi.consultations WHERE visit_date IS NOT NULL`;
    case 'procedure_prescriptions':
      return `SELECT MAX(prescription_date) as max_date FROM him_ttdi.procedure_prescriptions WHERE prescription_date IS NOT NULL`;
    case 'medicine_prescriptions':
      return `SELECT MAX(prescription_date) as max_date FROM him_ttdi.medicine_prescriptions WHERE prescription_date IS NOT NULL`;
    case 'itemized_sales':
      return `SELECT MAX(visit_date) as max_date FROM him_ttdi.itemized_sales WHERE visit_date IS NOT NULL`;
    case 'invoices':
      return `SELECT MAX(invoice_date::date) as max_date FROM him_ttdi.invoices WHERE invoice_date IS NOT NULL`;
    case 'daily_doctor_sales':
      return `SELECT MAX(sale_date) as max_date FROM him_ttdi.daily_doctor_sales WHERE sale_date IS NOT NULL`;
    case 'leads_tiktok_beg_biru':
    case 'leads_wsapme':
    case 'leads':
      return `SELECT MAX(created_at::date) as max_date FROM him_ttdi.leads WHERE created_at IS NOT NULL`;
    default:
      return null;
  }
}
