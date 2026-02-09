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
        // Get timestamp directly from database without timezone conversion
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

        // Use uploaded_at directly from csv_uploads table - timezone unaware
        // Format it as a simple string without timezone conversion
        // PostgreSQL returns it as a Date object, format it directly
        let uploadedAt: string | null = null;
        if (upload.uploaded_at) {
          // If it's a Date object, format it as ISO string but preserve the time
          // We'll format it as YYYY-MM-DDTHH:mm:ss (without timezone)
          if (upload.uploaded_at instanceof Date) {
            const year = upload.uploaded_at.getFullYear();
            const month = String(upload.uploaded_at.getMonth() + 1).padStart(2, '0');
            const day = String(upload.uploaded_at.getDate()).padStart(2, '0');
            const hours = String(upload.uploaded_at.getHours()).padStart(2, '0');
            const minutes = String(upload.uploaded_at.getMinutes()).padStart(2, '0');
            const seconds = String(upload.uploaded_at.getSeconds()).padStart(2, '0');
            uploadedAt = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
          } else {
            // If it's a string, use it as-is
            uploadedAt = String(upload.uploaded_at);
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
