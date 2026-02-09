/**
 * Test Upload API - Simple test to verify upload logging works
 */

import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db/client';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const pool = getPool();
    
    // Test insert
    const result = await pool.query(
      `INSERT INTO him_ttdi.csv_uploads 
       (file_name, table_name, rows_processed, upload_status, uploaded_at)
       VALUES ($1, $2, $3, 'success', NOW())
       RETURNING upload_id`,
      ['test-file.csv', 'patients', 10]
    );

    return NextResponse.json({
      success: true,
      message: 'Test upload logged successfully',
      uploadId: result.rows[0].upload_id,
    });
  } catch (error: any) {
    console.error('Test upload error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to test upload logging',
        details: error.stack,
      },
      { status: 500 }
    );
  }
}
