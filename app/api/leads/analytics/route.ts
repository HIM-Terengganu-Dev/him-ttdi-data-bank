/**
 * Leads Analytics API Route
 * Returns aggregated analytics data for leads dashboard
 */

import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db/client';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pool = getPool();

    // 1. Overall statistics
    // Use normalized phone matching (digits only) to match leads to patients
    const overallStats = await pool.query(`
      SELECT 
        COUNT(DISTINCT l.lead_id) as total_leads,
        COUNT(DISTINCT CASE WHEN p.patient_id IS NOT NULL THEN l.lead_id END) as existing_patients,
        COUNT(DISTINCT CASE WHEN p.patient_id IS NULL THEN l.lead_id END) as non_patients,
        (SELECT COUNT(*) FROM him_ttdi.patients) as total_patients
      FROM him_ttdi.leads l
      LEFT JOIN him_ttdi.patients p 
        ON REGEXP_REPLACE(l.phone_number, '[^0-9]', '', 'g') = 
           REGEXP_REPLACE(p.phone_no, '[^0-9]', '', 'g')
    `);

    // 2. Source distribution
    const sourceDistribution = await pool.query(`
      SELECT 
        ls.source_name,
        COUNT(DISTINCT lsa.lead_id) as lead_count
      FROM him_ttdi.lead_sources ls
      LEFT JOIN him_ttdi.lead_source_assignments lsa ON ls.source_id = lsa.source_id
      LEFT JOIN him_ttdi.leads l ON lsa.lead_id = l.lead_id
      GROUP BY ls.source_name
      ORDER BY lead_count DESC
    `);

    // 3. Tag distribution
    const tagDistribution = await pool.query(`
      SELECT 
        lt.tag_name,
        COUNT(DISTINCT lta.lead_id) as lead_count
      FROM him_ttdi.lead_tags lt
      LEFT JOIN him_ttdi.lead_tag_assignments lta ON lt.tag_id = lta.tag_id
      LEFT JOIN him_ttdi.leads l ON lta.lead_id = l.lead_id
      GROUP BY lt.tag_name
      ORDER BY lead_count DESC
    `);

    // 4. Gender distribution
    const genderDistribution = await pool.query(`
      SELECT 
        COALESCE(p.gender, l.gender, 'Unknown') as gender,
        COUNT(DISTINCT l.lead_id) as lead_count
      FROM him_ttdi.leads l
      LEFT JOIN him_ttdi.patients p 
        ON REGEXP_REPLACE(l.phone_number, '[^0-9]', '', 'g') = 
           REGEXP_REPLACE(p.phone_no, '[^0-9]', '', 'g')
      GROUP BY COALESCE(p.gender, l.gender, 'Unknown')
      ORDER BY lead_count DESC
    `);

    // 5. Province/State distribution
    const provinceDistribution = await pool.query(`
      SELECT 
        COALESCE(l.province_state, 'Unknown') as province_state,
        COUNT(DISTINCT l.lead_id) as lead_count
      FROM him_ttdi.leads l
      GROUP BY l.province_state
      ORDER BY lead_count DESC
      LIMIT 10
    `);

    // 6. Age distribution for existing patients
    const ageDistribution = await pool.query(`
      WITH age_groups AS (
        SELECT 
          CASE 
            WHEN p.age IS NULL THEN 'Unknown'
            WHEN p.age < 18 THEN 'Under 18'
            WHEN p.age BETWEEN 18 AND 25 THEN '18-25'
            WHEN p.age BETWEEN 26 AND 35 THEN '26-35'
            WHEN p.age BETWEEN 36 AND 45 THEN '36-45'
            WHEN p.age BETWEEN 46 AND 55 THEN '46-55'
            WHEN p.age BETWEEN 56 AND 65 THEN '56-65'
            WHEN p.age > 65 THEN 'Over 65'
          END as age_group,
          COUNT(DISTINCT l.lead_id) as lead_count
        FROM him_ttdi.leads l
        JOIN him_ttdi.patients p 
          ON REGEXP_REPLACE(l.phone_number, '[^0-9]', '', 'g') = 
             REGEXP_REPLACE(p.phone_no, '[^0-9]', '', 'g')
        GROUP BY 
          CASE 
            WHEN p.age IS NULL THEN 'Unknown'
            WHEN p.age < 18 THEN 'Under 18'
            WHEN p.age BETWEEN 18 AND 25 THEN '18-25'
            WHEN p.age BETWEEN 26 AND 35 THEN '26-35'
            WHEN p.age BETWEEN 36 AND 45 THEN '36-45'
            WHEN p.age BETWEEN 46 AND 55 THEN '46-55'
            WHEN p.age BETWEEN 56 AND 65 THEN '56-65'
            WHEN p.age > 65 THEN 'Over 65'
          END
      )
      SELECT * FROM age_groups
      ORDER BY 
        CASE age_group
          WHEN 'Under 18' THEN 1
          WHEN '18-25' THEN 2
          WHEN '26-35' THEN 3
          WHEN '36-45' THEN 4
          WHEN '46-55' THEN 5
          WHEN '56-65' THEN 6
          WHEN 'Over 65' THEN 7
          WHEN 'Unknown' THEN 8
        END
    `);

    // 7. Lead creation trend (by date)
    const leadTrend = await pool.query(`
      SELECT 
        DATE(l.created_at) as date,
        COUNT(DISTINCT l.lead_id) as lead_count
      FROM him_ttdi.leads l
      GROUP BY DATE(l.created_at)
      ORDER BY date DESC
      LIMIT 30
    `);

    // 8. Status distribution (for TikTok Beg Biru)
    const statusDistribution = await pool.query(`
      SELECT 
        COALESCE(l.status, 'Unknown') as status,
        COUNT(DISTINCT l.lead_id) as lead_count
      FROM him_ttdi.leads l
      WHERE l.status IS NOT NULL
      GROUP BY l.status
      ORDER BY lead_count DESC
    `);

    return NextResponse.json({
      success: true,
      data: {
        overall: overallStats.rows[0],
        sources: sourceDistribution.rows,
        tags: tagDistribution.rows,
        gender: genderDistribution.rows,
        provinces: provinceDistribution.rows,
        ageGroups: ageDistribution.rows,
        leadTrend: leadTrend.rows,
        status: statusDistribution.rows,
      },
    });
  } catch (error: any) {
    console.error('Error fetching leads analytics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch leads analytics' },
      { status: 500 }
    );
  }
}
