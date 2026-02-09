/**
 * Sources API Route
 * GET: Get all sources
 * POST: Create a new source
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db/client';
import * as fs from 'fs';
import * as path from 'path';

export const runtime = 'nodejs';

function logDebug(message: string) {
  try {
    const logPath = path.join(process.cwd(), 'api-debug.log');
    fs.appendFileSync(logPath, `${new Date().toISOString()} - ${message}\n`);
  } catch (e) {
    // ignore
  }
}

export async function GET() {
  try {
    logDebug('GET /api/sources called');
    logDebug(`Env DB: ${process.env.HIM_WELLNESS_TTDI_DB ? 'Found' : 'Missing'}`);
    logDebug(`Env DDL: ${process.env.HIM_WELLNESS_TTDI_DB_DDL ? 'Found' : 'Missing'}`);

    const pool = getPool();
    logDebug('Pool obtained');

    const result = await pool.query(
      `SELECT source_id, source_name, created_at, updated_at
       FROM him_ttdi.lead_sources
       ORDER BY source_name ASC`
    );

    return NextResponse.json({
      success: true,
      sources: result.rows,
    });
  } catch (error: any) {
    console.error('Error fetching sources:', error);
    logDebug(`Error fetching sources: ${error.message}`);
    logDebug(`Stack: ${error.stack}`);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch sources' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceName } = body;

    if (!sourceName || typeof sourceName !== 'string' || sourceName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Source name is required' },
        { status: 400 }
      );
    }

    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO him_ttdi.lead_sources (source_name)
       VALUES ($1)
       ON CONFLICT (source_name) DO UPDATE SET updated_at = NOW()
       RETURNING source_id, source_name, created_at, updated_at`,
      [sourceName.trim()]
    );

    return NextResponse.json({
      success: true,
      source: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error creating source:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create source' },
      { status: 500 }
    );
  }
}
