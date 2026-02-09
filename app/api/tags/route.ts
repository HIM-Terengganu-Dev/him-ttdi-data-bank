/**
 * Tags API Route
 * GET: Get all tags
 * POST: Create a new tag
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db/client';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT tag_id, tag_name, created_at, updated_at
       FROM him_ttdi.lead_tags
       ORDER BY tag_name ASC`
    );

    return NextResponse.json({
      success: true,
      tags: result.rows,
    });
  } catch (error: any) {
    console.error('Error fetching tags:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tags' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tagName } = body;

    if (!tagName || typeof tagName !== 'string' || tagName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Tag name is required' },
        { status: 400 }
      );
    }

    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO him_ttdi.lead_tags (tag_name)
       VALUES ($1)
       ON CONFLICT (tag_name) DO UPDATE SET updated_at = NOW()
       RETURNING tag_id, tag_name, created_at, updated_at`,
      [tagName.trim()]
    );

    return NextResponse.json({
      success: true,
      tag: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error creating tag:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create tag' },
      { status: 500 }
    );
  }
}
