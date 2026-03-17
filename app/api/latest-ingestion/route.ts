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
    const filter = searchParams.get('filter') || 'all'; // 'remedi', 'leads', 'wabot', or 'all'
    
    const pool = getPool();
    // Get all file types
    const allFileTypes = getRemediiFileTypes();
    
    // Filter file types based on request
    let validTables: string[];
    if (filter === 'remedi') {
      validTables = allFileTypes.filter(ft => ft.type !== 'leads_tiktok_beg_biru' && ft.type !== 'leads_wsapme' && ft.type !== 'leads_device_export' && ft.type !== 'wabot_blast').map(ft => ft.tableName);
    } else if (filter === 'leads') {
      validTables = allFileTypes.filter(ft => ft.type === 'leads_tiktok_beg_biru' || ft.type === 'leads_wsapme' || ft.type === 'leads_device_export').map(ft => ft.tableName);
      validTables.push('leads'); // fallback for older uploads
    } else if (filter === 'wabot') {
      validTables = allFileTypes.filter(ft => ft.type === 'wabot_blast').map(ft => ft.tableName);
    } else {
      validTables = allFileTypes.map(ft => ft.tableName);
      validTables.push('leads');
    }

    // Query recent 30 uploads chronologically
    const uploadsResult = await pool.query(
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
      WHERE table_name = ANY($1)
      ORDER BY uploaded_at DESC
      LIMIT 30`,
      [validTables]
    );

    // Get max dates for matching tables
    const tablesInUploads = [...new Set(uploadsResult.rows.map(r => r.table_name))];
    const tableMaxDates: Record<string, string | null> = {};

    await Promise.all(
      tablesInUploads.map(async (tableName) => {
        try {
          const dateQuery = getDateQueryForTable(tableName);
          if (dateQuery) {
             const dateResult = await pool.query(dateQuery);
             if (dateResult.rows.length > 0 && dateResult.rows[0].max_date) {
               const dbDate = dateResult.rows[0].max_date;
               if (typeof dbDate === 'string') {
                 tableMaxDates[tableName] = dbDate.split('T')[0].split(' ')[0];
               } else if (dbDate instanceof Date) {
                 const year = dbDate.getFullYear();
                 const month = String(dbDate.getMonth() + 1).padStart(2, '0');
                 const day = String(dbDate.getDate()).padStart(2, '0');
                 tableMaxDates[tableName] = `${year}-${month}-${day}`;
               } else {
                 tableMaxDates[tableName] = String(dbDate).split('T')[0].split(' ')[0];
               }
             }
          }
        } catch (err) {
          console.error('Error extracting CSV date:', err);
        }
      })
    );

    const latestIngestions = uploadsResult.rows.map(upload => {
      let uploadedAt: string | null = null;
      if (upload.uploaded_at) {
        if (upload.uploaded_at instanceof Date) {
          const year = upload.uploaded_at.getFullYear();
          const month = String(upload.uploaded_at.getMonth() + 1).padStart(2, '0');
          const day = String(upload.uploaded_at.getDate()).padStart(2, '0');
          const hours = String(upload.uploaded_at.getHours()).padStart(2, '0');
          const minutes = String(upload.uploaded_at.getMinutes()).padStart(2, '0');
          const seconds = String(upload.uploaded_at.getSeconds()).padStart(2, '0');
          uploadedAt = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
        } else {
          uploadedAt = String(upload.uploaded_at);
        }
      }

      const fileTypeInfo = allFileTypes.find(ft => ft.tableName === upload.table_name);
      return {
        fileType: fileTypeInfo ? fileTypeInfo.displayName : upload.table_name,
        tableName: upload.table_name,
        hasData: true,
        fileName: upload.file_name,
        uploadedAt: uploadedAt,
        csvDate: tableMaxDates[upload.table_name] || null,
        rowsProcessed: upload.rows_processed,
        rowsInserted: upload.rows_inserted,
        rowsUpdated: upload.rows_updated,
        rowsFailed: upload.rows_failed,
        uploadStatus: upload.upload_status,
      };
    });

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
  // Get MAX date to represent the CSV data date range end (e.g., "till 31st Jan 2026")
  // Use DATE() to ensure timezone-blind date extraction
  // Cast to DATE to remove time component and timezone
  switch (tableName) {
    case 'patients':
      return `SELECT MAX(DATE(first_visit_date))::text as max_date FROM him_ttdi.patients WHERE first_visit_date IS NOT NULL`;
    case 'consultations':
      return `SELECT MAX(DATE(visit_date))::text as max_date FROM him_ttdi.consultations WHERE visit_date IS NOT NULL`;
    case 'procedure_prescriptions':
      // Get MAX date from procedure prescriptions (represents "till" date in CSV)
      // Use DATE() to extract date part only, timezone-blind
      return `SELECT MAX(DATE(prescription_date))::text as max_date FROM him_ttdi.procedure_prescriptions WHERE prescription_date IS NOT NULL`;
    case 'medicine_prescriptions':
      return `SELECT MAX(DATE(prescription_date))::text as max_date FROM him_ttdi.medicine_prescriptions WHERE prescription_date IS NOT NULL`;
    case 'itemized_sales':
      return `SELECT MAX(DATE(visit_date))::text as max_date FROM him_ttdi.itemized_sales WHERE visit_date IS NOT NULL`;
    case 'invoices':
      return `SELECT MAX(DATE(invoice_date))::text as max_date FROM him_ttdi.invoices WHERE invoice_date IS NOT NULL`;
    case 'daily_doctor_sales':
      return `SELECT MAX(DATE(sale_date))::text as max_date FROM him_ttdi.daily_doctor_sales WHERE sale_date IS NOT NULL`;
    case 'leads_tiktok_beg_biru':
    case 'leads_wsapme':
    case 'leads_device_export':
    case 'leads':
      return `SELECT MAX(DATE(created_at))::text as max_date FROM him_ttdi.leads WHERE created_at IS NOT NULL`;
    case 'wabot_blasts':
      return `SELECT MAX(DATE(sent))::text as max_date FROM him_ttdi.wabot_blasts WHERE sent IS NOT NULL`;
    default:
      return null;
  }
}
