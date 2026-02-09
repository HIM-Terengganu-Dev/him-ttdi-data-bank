/**
 * Leads Export API Route
 * Exports leads to CSV with filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db/client';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

interface ExportFilters {
  leadType?: 'all' | 'existing_patients' | 'non_patients';
  sourceIds?: number[];
  tagIds?: number[];
  gender?: string[];
  provinceState?: string[];
  ageMin?: number;
  ageMax?: number;
  createdDateFrom?: string;
  createdDateTo?: string;
  firstVisitDateFrom?: string;
  firstVisitDateTo?: string;
  visitCountMin?: number;
  visitCountMax?: number;
  status?: string[];
  sourceTraffic?: string[];
  sourceAction?: string[];
  sourceScenario?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const filters: ExportFilters = await request.json();
    const pool = getPool();

    // If leadType is 'existing_patients', query from patients table directly
    if (filters.leadType === 'existing_patients') {
      let query = `
        SELECT DISTINCT
          p.phone_no as phone_number,
          p.name
        FROM him_ttdi.patients p
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Gender filter
      if (filters.gender && filters.gender.length > 0) {
        query += ` AND p.gender = ANY($${paramIndex})`;
        params.push(filters.gender);
        paramIndex++;
      }

      // Age range filter
      if (filters.ageMin !== undefined || filters.ageMax !== undefined) {
        if (filters.ageMin !== undefined && filters.ageMax !== undefined) {
          query += ` AND p.age BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
          params.push(filters.ageMin, filters.ageMax);
          paramIndex += 2;
        } else if (filters.ageMin !== undefined) {
          query += ` AND p.age >= $${paramIndex}`;
          params.push(filters.ageMin);
          paramIndex++;
        } else if (filters.ageMax !== undefined) {
          query += ` AND p.age <= $${paramIndex}`;
          params.push(filters.ageMax);
          paramIndex++;
        }
      }

      // First visit date range
      if (filters.firstVisitDateFrom) {
        query += ` AND DATE(p.first_visit_date) >= $${paramIndex}::date`;
        params.push(filters.firstVisitDateFrom);
        paramIndex++;
      }
      if (filters.firstVisitDateTo) {
        query += ` AND DATE(p.first_visit_date) <= $${paramIndex}::date`;
        params.push(filters.firstVisitDateTo);
        paramIndex++;
      }

      // Visit count range
      if (filters.visitCountMin !== undefined || filters.visitCountMax !== undefined) {
        if (filters.visitCountMin !== undefined && filters.visitCountMax !== undefined) {
          query += ` AND p.visit_total BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
          params.push(filters.visitCountMin, filters.visitCountMax);
          paramIndex += 2;
        } else if (filters.visitCountMin !== undefined) {
          query += ` AND p.visit_total >= $${paramIndex}`;
          params.push(filters.visitCountMin);
          paramIndex++;
        } else if (filters.visitCountMax !== undefined) {
          query += ` AND p.visit_total <= $${paramIndex}`;
          params.push(filters.visitCountMax);
          paramIndex++;
        }
      }

      // If source or tag filters are applied, need to join with leads
      if ((filters.sourceIds && filters.sourceIds.length > 0) || 
          (filters.tagIds && filters.tagIds.length > 0) ||
          (filters.provinceState && filters.provinceState.length > 0) ||
          filters.createdDateFrom || filters.createdDateTo ||
          (filters.status && filters.status.length > 0) ||
          (filters.sourceTraffic && filters.sourceTraffic.length > 0) ||
          (filters.sourceAction && filters.sourceAction.length > 0) ||
          (filters.sourceScenario && filters.sourceScenario.length > 0)) {
        
        query = `
          SELECT DISTINCT
            p.phone_no as phone_number,
            p.name
          FROM him_ttdi.patients p
          INNER JOIN him_ttdi.leads l 
            ON REGEXP_REPLACE(l.phone_number, '[^0-9]', '', 'g') = 
               REGEXP_REPLACE(p.phone_no, '[^0-9]', '', 'g')
          LEFT JOIN him_ttdi.lead_source_assignments lsa ON l.lead_id = lsa.lead_id
          LEFT JOIN him_ttdi.lead_tag_assignments lta ON l.lead_id = lta.lead_id
          WHERE 1=1
        `;

        // Re-add all filters
        if (filters.gender && filters.gender.length > 0) {
          query += ` AND p.gender = ANY($${paramIndex})`;
          params.push(filters.gender);
          paramIndex++;
        }

        if (filters.ageMin !== undefined || filters.ageMax !== undefined) {
          if (filters.ageMin !== undefined && filters.ageMax !== undefined) {
            query += ` AND p.age BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
            params.push(filters.ageMin, filters.ageMax);
            paramIndex += 2;
          } else if (filters.ageMin !== undefined) {
            query += ` AND p.age >= $${paramIndex}`;
            params.push(filters.ageMin);
            paramIndex++;
          } else if (filters.ageMax !== undefined) {
            query += ` AND p.age <= $${paramIndex}`;
            params.push(filters.ageMax);
            paramIndex++;
          }
        }

        if (filters.firstVisitDateFrom) {
          query += ` AND DATE(p.first_visit_date) >= $${paramIndex}::date`;
          params.push(filters.firstVisitDateFrom);
          paramIndex++;
        }
        if (filters.firstVisitDateTo) {
          query += ` AND DATE(p.first_visit_date) <= $${paramIndex}::date`;
          params.push(filters.firstVisitDateTo);
          paramIndex++;
        }

        if (filters.visitCountMin !== undefined || filters.visitCountMax !== undefined) {
          if (filters.visitCountMin !== undefined && filters.visitCountMax !== undefined) {
            query += ` AND p.visit_total BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
            params.push(filters.visitCountMin, filters.visitCountMax);
            paramIndex += 2;
          } else if (filters.visitCountMin !== undefined) {
            query += ` AND p.visit_total >= $${paramIndex}`;
            params.push(filters.visitCountMin);
            paramIndex++;
          } else if (filters.visitCountMax !== undefined) {
            query += ` AND p.visit_total <= $${paramIndex}`;
            params.push(filters.visitCountMax);
            paramIndex++;
          }
        }

        // Source filter
        if (filters.sourceIds && filters.sourceIds.length > 0) {
          query += ` AND lsa.source_id = ANY($${paramIndex})`;
          params.push(filters.sourceIds);
          paramIndex++;
        }

        // Tag filter
        if (filters.tagIds && filters.tagIds.length > 0) {
          query += ` AND lta.tag_id = ANY($${paramIndex})`;
          params.push(filters.tagIds);
          paramIndex++;
        }

        // Province/State filter
        if (filters.provinceState && filters.provinceState.length > 0) {
          query += ` AND l.province_state = ANY($${paramIndex})`;
          params.push(filters.provinceState);
          paramIndex++;
        }

        // Created date range
        if (filters.createdDateFrom) {
          query += ` AND DATE(l.created_at) >= $${paramIndex}::date`;
          params.push(filters.createdDateFrom);
          paramIndex++;
        }
        if (filters.createdDateTo) {
          query += ` AND DATE(l.created_at) <= $${paramIndex}::date`;
          params.push(filters.createdDateTo);
          paramIndex++;
        }

        // Status filter (TikTok Beg Biru)
        if (filters.status && filters.status.length > 0) {
          query += ` AND l.status = ANY($${paramIndex})`;
          params.push(filters.status);
          paramIndex++;
        }

        // Source traffic filter (TikTok Beg Biru)
        if (filters.sourceTraffic && filters.sourceTraffic.length > 0) {
          query += ` AND l.source_traffic = ANY($${paramIndex})`;
          params.push(filters.sourceTraffic);
          paramIndex++;
        }

        // Source action filter (TikTok Beg Biru)
        if (filters.sourceAction && filters.sourceAction.length > 0) {
          query += ` AND l.source_action = ANY($${paramIndex})`;
          params.push(filters.sourceAction);
          paramIndex++;
        }

        // Source scenario filter (TikTok Beg Biru)
        if (filters.sourceScenario && filters.sourceScenario.length > 0) {
          query += ` AND l.source_scenario = ANY($${paramIndex})`;
          params.push(filters.sourceScenario);
          paramIndex++;
        }
      }

      query += ` ORDER BY p.phone_no`;

      // Execute query
      const result = await pool.query(query, params);

      // Convert to CSV
      const csvRows = ['phone,name'];
      result.rows.forEach((row) => {
        const phone = row.phone_number || '';
        const name = (row.name || '').replace(/"/g, '""'); // Escape quotes
        csvRows.push(`"${phone}","${name}"`);
      });

      const csvContent = csvRows.join('\n');

      // Return CSV as response
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="leads-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // For 'all' or 'non_patients', query from leads table
    // Build the query with filters
    let query = `
      SELECT DISTINCT
        l.phone_number,
        l.name
      FROM him_ttdi.leads l
      LEFT JOIN him_ttdi.patients p 
        ON REGEXP_REPLACE(l.phone_number, '[^0-9]', '', 'g') = 
           REGEXP_REPLACE(p.phone_no, '[^0-9]', '', 'g')
      LEFT JOIN him_ttdi.lead_source_assignments lsa ON l.lead_id = lsa.lead_id
      LEFT JOIN him_ttdi.lead_tag_assignments lta ON l.lead_id = lta.lead_id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Lead type filter
    if (filters.leadType === 'non_patients') {
      query += ` AND p.patient_id IS NULL`;
    }

    // Source filter
    if (filters.sourceIds && filters.sourceIds.length > 0) {
      query += ` AND lsa.source_id = ANY($${paramIndex})`;
      params.push(filters.sourceIds);
      paramIndex++;
    }

    // Tag filter
    if (filters.tagIds && filters.tagIds.length > 0) {
      query += ` AND lta.tag_id = ANY($${paramIndex})`;
      params.push(filters.tagIds);
      paramIndex++;
    }

    // Gender filter
    if (filters.gender && filters.gender.length > 0) {
      query += ` AND COALESCE(p.gender, l.gender, '') = ANY($${paramIndex})`;
      params.push(filters.gender);
      paramIndex++;
    }

    // Province/State filter
    if (filters.provinceState && filters.provinceState.length > 0) {
      query += ` AND l.province_state = ANY($${paramIndex})`;
      params.push(filters.provinceState);
      paramIndex++;
    }

    // Age range filter (only for existing patients)
    if (filters.ageMin !== undefined || filters.ageMax !== undefined) {
      if (filters.ageMin !== undefined && filters.ageMax !== undefined) {
        query += ` AND p.age BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
        params.push(filters.ageMin, filters.ageMax);
        paramIndex += 2;
      } else if (filters.ageMin !== undefined) {
        query += ` AND p.age >= $${paramIndex}`;
        params.push(filters.ageMin);
        paramIndex++;
      } else if (filters.ageMax !== undefined) {
        query += ` AND p.age <= $${paramIndex}`;
        params.push(filters.ageMax);
        paramIndex++;
      }
    }

    // Created date range
    if (filters.createdDateFrom) {
      query += ` AND DATE(l.created_at) >= $${paramIndex}::date`;
      params.push(filters.createdDateFrom);
      paramIndex++;
    }
    if (filters.createdDateTo) {
      query += ` AND DATE(l.created_at) <= $${paramIndex}::date`;
      params.push(filters.createdDateTo);
      paramIndex++;
    }

    // First visit date range (only for existing patients)
    if (filters.firstVisitDateFrom) {
      query += ` AND DATE(p.first_visit_date) >= $${paramIndex}::date`;
      params.push(filters.firstVisitDateFrom);
      paramIndex++;
    }
    if (filters.firstVisitDateTo) {
      query += ` AND DATE(p.first_visit_date) <= $${paramIndex}::date`;
      params.push(filters.firstVisitDateTo);
      paramIndex++;
    }

    // Visit count range (only for existing patients)
    if (filters.visitCountMin !== undefined || filters.visitCountMax !== undefined) {
      if (filters.visitCountMin !== undefined && filters.visitCountMax !== undefined) {
        query += ` AND p.visit_total BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
        params.push(filters.visitCountMin, filters.visitCountMax);
        paramIndex += 2;
      } else if (filters.visitCountMin !== undefined) {
        query += ` AND p.visit_total >= $${paramIndex}`;
        params.push(filters.visitCountMin);
        paramIndex++;
      } else if (filters.visitCountMax !== undefined) {
        query += ` AND p.visit_total <= $${paramIndex}`;
        params.push(filters.visitCountMax);
        paramIndex++;
      }
    }

    // Status filter (TikTok Beg Biru)
    if (filters.status && filters.status.length > 0) {
      query += ` AND l.status = ANY($${paramIndex})`;
      params.push(filters.status);
      paramIndex++;
    }

    // Source traffic filter (TikTok Beg Biru)
    if (filters.sourceTraffic && filters.sourceTraffic.length > 0) {
      query += ` AND l.source_traffic = ANY($${paramIndex})`;
      params.push(filters.sourceTraffic);
      paramIndex++;
    }

    // Source action filter (TikTok Beg Biru)
    if (filters.sourceAction && filters.sourceAction.length > 0) {
      query += ` AND l.source_action = ANY($${paramIndex})`;
      params.push(filters.sourceAction);
      paramIndex++;
    }

    // Source scenario filter (TikTok Beg Biru)
    if (filters.sourceScenario && filters.sourceScenario.length > 0) {
      query += ` AND l.source_scenario = ANY($${paramIndex})`;
      params.push(filters.sourceScenario);
      paramIndex++;
    }

    query += ` ORDER BY l.phone_number`;

    // Execute query
    const result = await pool.query(query, params);

    // Convert to CSV
    const csvRows = ['phone,name'];
    result.rows.forEach((row) => {
      const phone = row.phone_number || '';
      const name = (row.name || '').replace(/"/g, '""'); // Escape quotes
      csvRows.push(`"${phone}","${name}"`);
    });

    const csvContent = csvRows.join('\n');

    // Return CSV as response
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="leads-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting leads:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export leads' },
      { status: 500 }
    );
  }
}
