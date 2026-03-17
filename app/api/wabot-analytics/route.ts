import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db/client';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const pool = getPool();
    
    // 1. Total KPI Metrics
    const kpiResult = await pool.query(`
      SELECT 
        COUNT(*) as total_blast,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as total_delivered,
        COUNT(CASE WHEN status = 'read' OR read IS NOT NULL THEN 1 END) as total_read,
        COUNT(CASE WHEN status = 'replied' OR replied IS NOT NULL THEN 1 END) as total_replied,
        COUNT(CASE WHEN failed = true THEN 1 END) as total_failed
      FROM him_ttdi.wabot_blasts
    `);

    const kpi = kpiResult.rows[0];
    const totalBlast = parseInt(kpi.total_blast, 10);
    const deliveredCount = parseInt(kpi.total_delivered, 10);
    const readCount = parseInt(kpi.total_read, 10);
    const repliedCount = parseInt(kpi.total_replied, 10);

    const metrics = {
      totalBlast,
      deliveryRate: totalBlast > 0 ? ((deliveredCount / totalBlast) * 100).toFixed(2) : '0.00',
      readRate: totalBlast > 0 ? ((readCount / totalBlast) * 100).toFixed(2) : '0.00',
      replyRate: totalBlast > 0 ? ((repliedCount / totalBlast) * 100).toFixed(2) : '0.00',
    };

    // 2. Funnel Data
    const funnel = [
      { name: 'Sent', value: totalBlast },
      { name: 'Delivered', value: deliveredCount },
      { name: 'Read', value: readCount },
      { name: 'Replied', value: repliedCount },
    ];

    // 3. Failure Analysis (Group by ERROR)
    const errorResult = await pool.query(`
      SELECT 
        COALESCE(error, 'Unknown Reason') as error_reason,
        COUNT(*) as count
      FROM him_ttdi.wabot_blasts
      WHERE failed = true
      GROUP BY COALESCE(error, 'Unknown Reason')
      ORDER BY count DESC
      LIMIT 10
    `);
    
    // 4. Time Series (Blast activity by date)
    const timeSeriesResult = await pool.query(`
      SELECT 
        DATE(sent) as date,
        COUNT(*) as count
      FROM him_ttdi.wabot_blasts
      WHERE sent IS NOT NULL
      GROUP BY DATE(sent)
      ORDER BY DATE(sent) ASC
      LIMIT 30
    `);
    
    // Format dates for time series
    const timeSeriesData = timeSeriesResult.rows.map((row) => {
      const dbDate = row.date;
      let dateStr = '';
      if (typeof dbDate === 'string') {
        dateStr = dbDate.split('T')[0];
      } else if (dbDate instanceof Date) {
        dateStr = dbDate.toISOString().split('T')[0];
      } else {
        dateStr = String(dbDate).split('T')[0];
      }
      return {
        date: dateStr,
        blasts: parseInt(row.count, 10)
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        metrics,
        funnel,
        failureAnalysis: errorResult.rows.map(r => ({ reason: r.error_reason, count: parseInt(r.count, 10) })),
        timeSeries: timeSeriesData
      }
    });

  } catch (error: any) {
    console.error('Error fetching WABOT analytics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
