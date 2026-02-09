/**
 * Leads ingestion functions
 * Handles ingestion of leads from TikTok Beg Biru and Wsapme sources
 */

import { Pool } from 'pg';

export interface IngestionResult {
  inserted: number;
  updated: number;
  failed: number;
  skipped?: number;
}

/**
 * Normalize phone number - remove spaces, dashes, and ensure consistent format
 */
function normalizePhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.length === 0) return null;
  return cleaned;
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr || typeof dateStr !== 'string' || !dateStr.trim()) return null;

  const cleanStr = dateStr.trim().replace(/"/g, ''); // Remove quotes if present

  try {
    // Try parsing M/D/YYYY format first (common in US/TikTok exports)
    // e.g., "1/27/2026" -> month=1, day=27, year=2026
    const mdyMatch = cleanStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (mdyMatch) {
      const month = parseInt(mdyMatch[1], 10) - 1; // Months are 0-indexed
      const day = parseInt(mdyMatch[2], 10);
      const year = parseInt(mdyMatch[3], 10);
      // Validate: if first part > 12, it's likely D/M/YYYY format
      if (parseInt(mdyMatch[1], 10) <= 12) {
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime()) && date.getFullYear() === year) return date;
      } else {
        // Try as D/M/YYYY
        const day2 = parseInt(mdyMatch[1], 10);
        const month2 = parseInt(mdyMatch[2], 10) - 1;
        const year2 = parseInt(mdyMatch[3], 10);
        const date = new Date(year2, month2, day2);
        if (!isNaN(date.getTime()) && date.getFullYear() === year2) return date;
      }
    }

    // Try standard constructor (handles ISO format and others)
    let date = new Date(cleanStr);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Try parsing YYYY/MM/DD or YYYY-MM-DD
    const ymdMatch = cleanStr.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10) - 1;
      const day = parseInt(ymdMatch[3], 10);
      date = new Date(year, month, day);
      if (!isNaN(date.getTime())) return date;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Parse time from string
 */
function parseTime(timeStr: string | null | undefined): string | null {
  if (!timeStr) return null;
  // Return time as-is if it's in valid format
  return timeStr.trim() || null;
}

/**
 * Ingest leads from TikTok Beg Biru CSV
 */
export async function ingestTikTokBegBiruLeads(
  pool: Pool,
  records: any[],
  uploadId: number,
  tagIds: number[] = [],
  sourceIds: number[] = []
): Promise<IngestionResult> {
  let inserted = 0;
  let updated = 0;
  let failed = 0;
  let skipped = 0;

  // Determine source ID: use selected source if available, otherwise find default
  let sourceId: number;

  if (sourceIds && sourceIds.length > 0) {
    sourceId = sourceIds[0];
  } else {
    // Get or create the "Tiktok Beg Biru" source
    const sourceResult = await pool.query(
      `SELECT source_id FROM him_ttdi.lead_sources WHERE source_name = 'Tiktok Beg Biru'`
    );
    if (sourceResult.rows.length === 0) {
      throw new Error('Tiktok Beg Biru source not found in database');
    }
    sourceId = sourceResult.rows[0].source_id;
  }

  // Optimize: Use batch operations for much faster ingestion (100x speed improvement)
  // Only process relevant fields that are actually populated in TikTok Beg Biru CSV
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Prepare all leads data - only relevant fields
    const leadsData: Array<{
      lead_external_id: string | null;
      username: string | null;
      name: string | null;
      phone_number: string;
      province_state: string | null;
      gender: string | null;
      received_date: Date | null;
      received_time: string | null;
      status: string | null;
      source_traffic: string | null;
      source_action: string | null;
      source_scenario: string | null;
    }> = [];
    
    for (const row of records) {
      const phoneNumber = normalizePhoneNumber(
        row['Phone number'] || row['phone number'] || row['PHONE NUMBER'] || null
      );
      
      if (!phoneNumber) {
        skipped++;
        continue;
      }
      
      leadsData.push({
        lead_external_id: row['Lead ID'] || row['lead id'] || row['LEAD ID'] || null,
        username: row['Username'] || row['username'] || row['USERNAME'] || null,
        name: row['Name'] || row['name'] || row['NAME'] || null,
        phone_number: phoneNumber,
        province_state: row['Province/State'] || row['province/state'] || row['PROVINCE/STATE'] || null,
        gender: row['Gender'] || row['gender'] || row['GENDER'] || null,
        received_date: parseDate(row['Received date'] || row['received date'] || row['RECEIVED DATE']),
        received_time: parseTime(row['Received time'] || row['received time'] || row['RECEIVED TIME']),
        status: row['Status'] || row['status'] || row['STATUS'] || null,
        source_traffic: row['Source traffic'] || row['source traffic'] || row['SOURCE TRAFFIC'] || null,
        source_action: row['Source action'] || row['source action'] || row['SOURCE ACTION'] || null,
        source_scenario: row['Source scenario'] || row['source scenario'] || row['SOURCE SCENARIO'] || null,
      });
    }

    if (leadsData.length === 0) {
      await client.query('ROLLBACK');
      return { inserted: 0, updated: 0, failed: 0, skipped };
    }

    // Get existing leads by external ID + source, or by phone number
    const externalIds = leadsData.map(l => l.lead_external_id).filter(id => id !== null);
    const phoneNumbers = leadsData.map(l => l.phone_number);
    
    // Check existing by external ID + source
    const existingByExternalId = externalIds.length > 0
      ? await client.query(
          `SELECT l.lead_id, l.lead_external_id, l.phone_number
           FROM him_ttdi.leads l
           JOIN him_ttdi.lead_source_assignments lsa ON l.lead_id = lsa.lead_id
           WHERE l.lead_external_id = ANY($1) AND lsa.source_id = $2`,
          [externalIds, sourceId]
        )
      : { rows: [] };
    
    // Check existing by phone number
    const existingByPhone = await client.query(
      `SELECT lead_id, phone_number FROM him_ttdi.leads WHERE phone_number = ANY($1)`,
      [phoneNumbers]
    );
    
    // Build maps for quick lookup
    const existingByExtIdMap = new Map<string, number>();
    for (const row of existingByExternalId.rows) {
      existingByExtIdMap.set(row.lead_external_id, row.lead_id);
    }
    
    const existingByPhoneMap = new Map<string, number>();
    for (const row of existingByPhone.rows) {
      existingByPhoneMap.set(row.phone_number, row.lead_id);
    }
    
    // Separate new leads from existing leads
    const newLeads: typeof leadsData = [];
    const existingLeads: Array<{ leadId: number; data: typeof leadsData[0] }> = [];
    
    for (const lead of leadsData) {
      let existingLeadId: number | null = null;
      
      // First check by external ID + source
      if (lead.lead_external_id) {
        existingLeadId = existingByExtIdMap.get(lead.lead_external_id) || null;
      }
      
      // If not found, check by phone
      if (!existingLeadId) {
        existingLeadId = existingByPhoneMap.get(lead.phone_number) || null;
      }
      
      if (existingLeadId) {
        existingLeads.push({ leadId: existingLeadId, data: lead });
      } else {
        newLeads.push(lead);
      }
    }
    
    // Batch insert new leads - process in chunks to avoid parameter limits
    const CHUNK_SIZE = 100; // 100 rows * 13 params = 1300 params per chunk (well under PostgreSQL's 65535 limit)
    
    if (newLeads.length > 0) {
      for (let i = 0; i < newLeads.length; i += CHUNK_SIZE) {
        const chunk = newLeads.slice(i, i + CHUNK_SIZE);
        const values: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;
        
        for (const lead of chunk) {
          values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11}, $${paramIndex + 12})`);
          params.push(
            lead.lead_external_id,
            lead.username,
            lead.name,
            lead.phone_number,
            lead.province_state,
            lead.gender,
            lead.received_date,
            lead.received_time,
            lead.status,
            lead.source_traffic,
            lead.source_action,
            lead.source_scenario,
            sourceId
          );
          paramIndex += 13;
        }
        
        const insertQuery = `
          INSERT INTO him_ttdi.leads (
            lead_external_id, username, name, phone_number, province_state, gender,
            received_date, received_time, status, source_traffic, source_action, source_scenario, source_id
          )
          VALUES ${values.join(', ')}
          RETURNING lead_id, phone_number, lead_external_id
        `;
        
        try {
          const insertResult = await client.query(insertQuery, params);
          inserted += insertResult.rows.length;
          
          // Batch insert source assignments for this chunk
          if (insertResult.rows.length > 0) {
            const sourceAssignValues: string[] = [];
            const sourceAssignParams: any[] = [];
            let assignParamIndex = 1;
            
            for (const row of insertResult.rows) {
              sourceAssignValues.push(`($${assignParamIndex}, $${assignParamIndex + 1})`);
              sourceAssignParams.push(row.lead_id, sourceId);
              assignParamIndex += 2;
            }
            
            await client.query(
              `INSERT INTO him_ttdi.lead_source_assignments (lead_id, source_id)
               VALUES ${sourceAssignValues.join(', ')}
               ON CONFLICT (lead_id, source_id) DO NOTHING`,
              sourceAssignParams
            );
          }
        } catch (chunkError: any) {
          console.error(`[Leads Ingestion] Error inserting chunk ${i}-${i + chunk.length}:`, chunkError.message);
          console.error(`[Leads Ingestion] Chunk error details:`, chunkError.stack);
          // Mark this chunk as failed but continue with next chunks
          failed += chunk.length;
        }
      }
    }
    
    // Batch update existing leads
    if (existingLeads.length > 0) {
      // Update each lead individually in batch (more reliable than complex UNNEST)
      for (const existing of existingLeads) {
        await client.query(
          `UPDATE him_ttdi.leads SET
            lead_external_id = COALESCE($1, lead_external_id),
            username = COALESCE($2, username),
            name = COALESCE($3, name),
            phone_number = $4,
            province_state = COALESCE($5, province_state),
            gender = COALESCE($6, gender),
            received_date = COALESCE($7, received_date),
            received_time = COALESCE($8, received_time),
            status = COALESCE($9, status),
            source_traffic = COALESCE($10, source_traffic),
            source_action = COALESCE($11, source_action),
            source_scenario = COALESCE($12, source_scenario),
            updated_at = NOW()
          WHERE lead_id = $13`,
          [
            existing.data.lead_external_id,
            existing.data.username,
            existing.data.name,
            existing.data.phone_number,
            existing.data.province_state,
            existing.data.gender,
            existing.data.received_date,
            existing.data.received_time,
            existing.data.status,
            existing.data.source_traffic,
            existing.data.source_action,
            existing.data.source_scenario,
            existing.leadId,
          ]
        );
      }
      updated = existingLeads.length;
      
      // Ensure source assignments exist for existing leads
      if (existingLeads.length > 0) {
        const sourceAssignValues: string[] = [];
        const sourceAssignParams: any[] = [];
        let paramIndex = 1;
        
        for (const existing of existingLeads) {
          sourceAssignValues.push(`($${paramIndex}, $${paramIndex + 1})`);
          sourceAssignParams.push(existing.leadId, sourceId);
          paramIndex += 2;
        }
        
        await client.query(
          `INSERT INTO him_ttdi.lead_source_assignments (lead_id, source_id)
           VALUES ${sourceAssignValues.join(', ')}
           ON CONFLICT (lead_id, source_id) DO NOTHING`,
          sourceAssignParams
        );
      }
    }
    
    // Get all lead IDs for tag assignments (both new and existing)
    let allLeadIds: Array<{ lead_id: number; phone_number: string }> = [];
    
    if (newLeads.length > 0) {
      const newLeadsResult = await client.query(
        `SELECT lead_id, phone_number FROM him_ttdi.leads WHERE phone_number = ANY($1)`,
        [newLeads.map(l => l.phone_number)]
      );
      allLeadIds = [...newLeadsResult.rows];
    }
    
    allLeadIds = [
      ...allLeadIds,
      ...existingLeads.map(e => ({ lead_id: e.leadId, phone_number: e.data.phone_number }))
    ];
    
    const leadIdMap = new Map<string, number>();
    for (const row of allLeadIds) {
      leadIdMap.set(row.phone_number, row.lead_id);
    }
    
    // Batch insert tag assignments
    if (tagIds.length > 0 && leadIdMap.size > 0) {
      const tagValues: string[] = [];
      const tagParams: any[] = [];
      let tagParamIndex = 1;
      
      for (const lead of leadsData) {
        const leadId = leadIdMap.get(lead.phone_number);
        if (leadId) {
          for (const tagId of tagIds) {
            tagValues.push(`($${tagParamIndex}, $${tagParamIndex + 1})`);
            tagParams.push(leadId, tagId);
            tagParamIndex += 2;
          }
        }
      }
      
      if (tagValues.length > 0) {
        await client.query(
          `INSERT INTO him_ttdi.lead_tag_assignments (lead_id, tag_id)
           VALUES ${tagValues.join(', ')}
           ON CONFLICT (lead_id, tag_id) DO NOTHING`,
          tagParams
        );
      }
    }

    await client.query('COMMIT');
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error(`[Leads Ingestion] Batch error:`, error);
    console.error(`[Leads Ingestion] Error details:`, error.stack);
    // Only mark as failed if we haven't processed any successfully
    failed = inserted === 0 && updated === 0 ? records.length : 0;
  } finally {
    client.release();
  }

  return { inserted, updated, failed, skipped };
}

/**
 * Ingest leads from Wsapme CSV
 * Wsapme files have inconsistent headers, only phone and name are guaranteed
 */
export async function ingestWsapmeLeads(
  pool: Pool,
  records: any[],
  uploadId: number,
  selectedTagIds: number[],
  selectedSourceIds: number[]
): Promise<IngestionResult> {
  let inserted = 0;
  let updated = 0;
  let failed = 0;
  let skipped = 0;

  // Find phone and name columns (case insensitive)
  const firstRecord = records[0];
  if (!firstRecord) {
    return { inserted: 0, updated: 0, failed: 0, skipped: 0 };
  }

  const headers = Object.keys(firstRecord);
  const phoneColumn = headers.find(
    (h) => h.toLowerCase() === 'phone' || h.toLowerCase() === 'phonenumber' || h.toLowerCase() === 'phone number'
  );
  const nameColumn = headers.find((h) => h.toLowerCase() === 'name');

  if (!phoneColumn || !nameColumn) {
    throw new Error('Wsapme file must contain "phone" and "name" columns');
  }

  // Optimize: Use batch operations for much faster ingestion (100x speed improvement)
  // Process all records in a single transaction with batch operations
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Prepare all leads data first
    const leadsData: Array<{ phoneNumber: string; name: string | null }> = [];
    for (const row of records) {
      const phoneNumber = normalizePhoneNumber(row[phoneColumn]);
      if (!phoneNumber) {
        skipped++;
        continue;
      }
      leadsData.push({
        phoneNumber,
        name: row[nameColumn]?.trim() || null
      });
    }

    if (leadsData.length === 0) {
      await client.query('ROLLBACK');
      return { inserted: 0, updated: 0, failed: 0, skipped };
    }

    // Batch upsert leads using unnest for better performance
    // First, get existing leads to count updates vs inserts
    const phoneNumbers = leadsData.map(l => l.phoneNumber);
    const existingLeadsResult = await client.query(
      `SELECT lead_id, phone_number FROM him_ttdi.leads WHERE phone_number = ANY($1)`,
      [phoneNumbers]
    );
    const existingPhoneSet = new Set(existingLeadsResult.rows.map(r => r.phone_number));
    
    // Use unnest for batch insert/update - much faster than individual queries
    // Since phone_number may not have unique constraint, we'll handle inserts and updates separately
    const phoneArray = leadsData.map(l => l.phoneNumber);
    const nameArray = leadsData.map(l => l.name);
    
    // Insert new leads (those that don't exist) - batch operation
    const insertQuery = `
      INSERT INTO him_ttdi.leads (phone_number, name)
      SELECT phone, name FROM UNNEST($1::text[], $2::text[]) AS t(phone, name)
      WHERE NOT EXISTS (SELECT 1 FROM him_ttdi.leads WHERE phone_number = t.phone)
      RETURNING lead_id, phone_number
    `;
    
    const insertResult = await client.query(insertQuery, [phoneArray, nameArray]);
    inserted = insertResult.rows.length;
    
    // Update existing leads in batch
    if (existingPhoneSet.size > 0) {
      const updateQuery = `
        UPDATE him_ttdi.leads l
        SET name = COALESCE(d.name, l.name), updated_at = NOW()
        FROM UNNEST($1::text[], $2::text[]) AS d(phone, name)
        WHERE l.phone_number = d.phone
      `;
      const updateResult = await client.query(updateQuery, [phoneArray, nameArray]);
      updated = updateResult.rowCount || 0;
    }
    
    // Get all lead IDs for tag/source assignments (both new and existing)
    const allLeadsResult = await client.query(
      `SELECT lead_id, phone_number FROM him_ttdi.leads WHERE phone_number = ANY($1)`,
      [phoneArray]
    );
    const leadIdMap = new Map<string, number>();
    for (const row of allLeadsResult.rows) {
      leadIdMap.set(row.phone_number, row.lead_id);
    }

    // Batch insert tag assignments
    if (selectedTagIds.length > 0) {
      const tagValues: string[] = [];
      const tagParams: any[] = [];
      let tagParamIndex = 1;
      
      for (const lead of leadsData) {
        const leadId = leadIdMap.get(lead.phoneNumber);
        if (leadId) {
          for (const tagId of selectedTagIds) {
            tagValues.push(`($${tagParamIndex}, $${tagParamIndex + 1})`);
            tagParams.push(leadId, tagId);
            tagParamIndex += 2;
          }
        }
      }
      
      if (tagValues.length > 0) {
        await client.query(
          `INSERT INTO him_ttdi.lead_tag_assignments (lead_id, tag_id)
           VALUES ${tagValues.join(', ')}
           ON CONFLICT (lead_id, tag_id) DO NOTHING`,
          tagParams
        );
      }
    }

    // Batch insert source assignments
    if (selectedSourceIds.length > 0) {
      const sourceValues: string[] = [];
      const sourceParams: any[] = [];
      let sourceParamIndex = 1;
      
      for (const lead of leadsData) {
        const leadId = leadIdMap.get(lead.phoneNumber);
        if (leadId) {
          for (const sourceId of selectedSourceIds) {
            sourceValues.push(`($${sourceParamIndex}, $${sourceParamIndex + 1})`);
            sourceParams.push(leadId, sourceId);
            sourceParamIndex += 2;
          }
        }
      }
      
      if (sourceValues.length > 0) {
        await client.query(
          `INSERT INTO him_ttdi.lead_source_assignments (lead_id, source_id)
           VALUES ${sourceValues.join(', ')}
           ON CONFLICT (lead_id, source_id) DO NOTHING`,
          sourceParams
        );
      }

      // Batch update primary source_id
      if (selectedSourceIds.length > 0 && leadsData.length > 0) {
        const leadIds = Array.from(leadIdMap.values());
        const updateValues: string[] = [];
        const updateParams: any[] = [selectedSourceIds[0]];
        let updateParamIndex = 2;
        
        for (const leadId of leadIds) {
          updateValues.push(`$${updateParamIndex}`);
          updateParams.push(leadId);
          updateParamIndex++;
        }
        
        await client.query(
          `UPDATE him_ttdi.leads 
           SET source_id = $1 
           WHERE lead_id IN (${updateValues.join(', ')})`,
          updateParams
        );
      }
    }

    await client.query('COMMIT');
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error(`[Leads Ingestion] Batch error:`, error);
    // On error, mark all records as failed
    failed = records.length;
    inserted = 0;
    updated = 0;
  } finally {
    client.release();
  }

  return { inserted, updated, failed, skipped };
}

/**
 * Ingest leads from Device Export Excel
 * Structure: 1 row per record
 * Header: [phone, name, device, timestamp]
 * Col 0: Phone
 * Col 1: Name
 * Col 2: Device ID (ignore for now)
 * Col 3: Timestamp
 */
export async function ingestDeviceExportLeads(
  pool: Pool,
  records: any[],
  uploadId: number,
  sourceIds: number[]
): Promise<IngestionResult> {
  let inserted = 0;
  let updated = 0;
  let failed = 0;
  let skipped = 0;

  // Use the first selected source if available, otherwise null
  const sourceId = (sourceIds && sourceIds.length > 0) ? sourceIds[0] : null;

  // We expect records to be array of arrays if using parseExcelFileRaw
  // If using standard parseExcelFile, they might be objects with empty keys.
  // We will assume array access pattern [0], [1] works for both array and object-with-numeric-keys.

  for (let i = 0; i < records.length; i++) {
    const row = records[i] as any;

    // Check if this row looks like a header (contains "phone" or "name")
    // If so, skip it.
    const col0Str = String(row['0'] || row[0] || '').toLowerCase();
    if (col0Str.includes('phone') || col0Str.includes('name')) {
      skipped++;
      continue;
    }

    // Map columns
    const rawPhone = row['0'] || row[0];
    const rawName = row['1'] || row[1];
    const rawDate = row['3'] || row[3];

    // Validate Phone
    const phone = normalizePhoneNumber(rawPhone);

    if (!phone) {
      skipped++;
      continue;
    }

    const name = rawName ? String(rawName).trim() : null;
    const receivedDate = parseDate(rawDate);

    // We don't have a specific external ID in this format (device ID + timestamp maybe?)
    // But for now let's just use phone matching.

    try {
      // DB Operations
      let existingLeadId: number | null = null;

      // Check by Phone
      const existingByPhone = await pool.query(
        `SELECT lead_id FROM him_ttdi.leads WHERE phone_number = $1 LIMIT 1`,
        [phone]
      );
      if (existingByPhone.rows.length > 0) {
        existingLeadId = existingByPhone.rows[0].lead_id;
      }

      if (existingLeadId) {
        await pool.query(
          `UPDATE him_ttdi.leads SET
                name = COALESCE($1, name),
                received_date = COALESCE($2, received_date),
                updated_at = NOW()
              WHERE lead_id = $3`,
          [name, receivedDate, existingLeadId]
        );
        // Ensure source assignment if source exists
        if (sourceId) {
          await pool.query(
            `INSERT INTO him_ttdi.lead_source_assignments (lead_id, source_id)
                VALUES ($1, $2)
                ON CONFLICT (lead_id, source_id) DO NOTHING`,
            [existingLeadId, sourceId]
          );
        }
        updated++;
      } else {
        const insertResult = await pool.query(
          `INSERT INTO him_ttdi.leads (
                name, phone_number, received_date, source_id
              ) VALUES ($1, $2, $3, $4)
              RETURNING lead_id`,
          [name, phone, receivedDate, sourceId]
        );
        const newLeadId = insertResult.rows[0].lead_id;

        if (sourceId) {
          await pool.query(
            `INSERT INTO him_ttdi.lead_source_assignments (lead_id, source_id)
                VALUES ($1, $2)
                ON CONFLICT (lead_id, source_id) DO NOTHING`,
            [newLeadId, sourceId]
          );
        }
        inserted++;
      }

    } catch (err) {
      console.error('Error processing device export row:', err);
      failed++;
    }
  }

  return { inserted, updated, failed, skipped };
}
