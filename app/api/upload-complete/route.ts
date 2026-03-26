import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db/client';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { uploadId, success, error } = await request.json();

    if (!uploadId) {
      return NextResponse.json({ error: 'Missing uploadId' }, { status: 400 });
    }

    const pool = getPool();

    if (success) {
      await pool.query(
        `UPDATE him_ttdi.csv_uploads 
         SET upload_status = 'success'
         WHERE upload_id = $1`,
        [uploadId]
      );
    } else {
      await pool.query(
        `UPDATE him_ttdi.csv_uploads 
         SET upload_status = 'failed',
             error_message = COALESCE($2, 'Client aborted upload')
         WHERE upload_id = $1`,
        [uploadId, error || null]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Upload Complete] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to finalize upload' }, { status: 500 });
  }
}
