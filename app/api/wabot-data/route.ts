import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db/client';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;
    
    const pool = getPool();
    
    // Get total count
    const countResult = await pool.query('SELECT COUNT(*) FROM him_ttdi.wabot_blasts');
    const total = parseInt(countResult.rows[0].count, 10);
    
    // Get data
    const result = await pool.query(
      `SELECT id, uid, receiver, status, sent, delivered, read, replied, failed, error, created_at
       FROM him_ttdi.wabot_blasts
       ORDER BY sent DESC NULLS LAST, created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Error fetching WABOT data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch WABOT data' },
      { status: 500 }
    );
  }
}
