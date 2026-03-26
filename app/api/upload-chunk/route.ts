import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db/client';
import { processUploadChunk } from '@/lib/ingestion/process-upload';

export const runtime = 'nodejs';
export const maxDuration = 300; // Allow 5 minutes just in case, though chunk shouldn't take long

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uploadId, records, fileType, tagIds = [], sourceIds = [] } = body;

    if (!uploadId || !records || !fileType) {
      return NextResponse.json({ error: 'Missing uploadId, records, or fileType' }, { status: 400 });
    }

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ success: true, message: 'No records to process' });
    }

    const result = await processUploadChunk(uploadId, records, fileType, tagIds, sourceIds);

    return NextResponse.json({
      success: true,
      result
    });
  } catch (error: any) {
    console.error('[Upload Chunk] Error:', error);
    
    // Attempt to log failure to the database if uploadId is provided
    try {
      const body = await request.clone().json().catch(() => ({}));
      if (body.uploadId) {
        const pool = getPool();
        await pool.query(
          `UPDATE him_ttdi.csv_uploads SET upload_status = 'failed', error_message = $1 WHERE upload_id = $2`,
          [error.message || 'Chunk processing failed', body.uploadId]
        );
      }
    } catch (e) {
      // Ignore inner logging errors
    }

    return NextResponse.json({ error: error.message || 'Failed to process chunk' }, { status: 500 });
  }
}
