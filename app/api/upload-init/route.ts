import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db/client';
import { detectFileType } from '@/lib/csv/file-detector';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { fileName, headers } = await request.json();

    if (!fileName || !headers || !Array.isArray(headers)) {
      return NextResponse.json({ error: 'Missing fileName or headers' }, { status: 400 });
    }

    const detected = detectFileType(fileName, headers);

    if (detected.type === 'unknown') {
      return NextResponse.json({ 
        error: 'Unknown file type. Please ensure this is a valid Remedii/WABOT/Leads CSV file.' 
      }, { status: 400 });
    }

    const pool = getPool();
    const uploadResult = await pool.query(
      `INSERT INTO him_ttdi.csv_uploads 
       (file_name, table_name, rows_processed, rows_inserted, rows_updated, rows_failed, upload_status, uploaded_at)
       VALUES ($1, $2, 0, 0, 0, 0, 'processing', NOW())
       RETURNING upload_id`,
      [fileName, detected.tableName]
    );

    const uploadId = uploadResult.rows[0].upload_id;

    return NextResponse.json({
      success: true,
      uploadId,
      fileType: detected.type,
      fileDisplayName: detected.displayName,
      tableName: detected.tableName,
    });
  } catch (error: any) {
    console.error('[Upload Init] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to initialize upload' }, { status: 500 });
  }
}
