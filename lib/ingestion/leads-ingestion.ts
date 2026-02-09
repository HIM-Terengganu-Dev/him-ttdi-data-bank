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

  const cleanStr = dateStr.trim();

  try {
    // Try standard constructor first
    let date = new Date(cleanStr);

    // Check if valid
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Try parsing DD/MM/YYYY or DD-MM-YYYY
    // Regex for DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = cleanStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1; // Months are 0-indexed
      const year = parseInt(dmyMatch[3], 10);
      date = new Date(year, month, day);
      if (!isNaN(date.getTime())) return date;
    }

    // Try parsing YYYY/MM/DD or YYYY-MM-DD (ISO usually handled by constructor but just in case)
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

  for (const row of records) {
    try {
      const leadExternalId = row['Lead ID'] || row['lead id'] || row['LEAD ID'] || null;
      const phoneNumber = normalizePhoneNumber(
        row['Phone number'] || row['phone number'] || row['PHONE NUMBER'] || null
      );

      // Skip if no phone number (required field)
      if (!phoneNumber) {
        skipped++;
        continue;
      }

      // Check if lead already exists (by external ID and source, or by phone)
      let existingLeadId: number | null = null;

      if (leadExternalId) {
        const existingByExternalId = await pool.query(
          `SELECT l.lead_id 
           FROM him_ttdi.leads l
           JOIN him_ttdi.lead_source_assignments lsa ON l.lead_id = lsa.lead_id
           WHERE l.lead_external_id = $1 AND lsa.source_id = $2
           LIMIT 1`,
          [leadExternalId, sourceId]
        );
        if (existingByExternalId.rows.length > 0) {
          existingLeadId = existingByExternalId.rows[0].lead_id;
        }
      }

      // If not found by external ID, check by phone number
      if (!existingLeadId) {
        const existingByPhone = await pool.query(
          `SELECT lead_id FROM him_ttdi.leads WHERE phone_number = $1 LIMIT 1`,
          [phoneNumber]
        );
        if (existingByPhone.rows.length > 0) {
          existingLeadId = existingByPhone.rows[0].lead_id;
        }
      }

      // Prepare lead data
      const receivedDate = parseDate(row['Received date'] || row['received date'] || row['RECEIVED DATE']);
      const receivedTime = parseTime(row['Received time'] || row['received time'] || row['RECEIVED TIME']);

      const leadData = {
        lead_external_id: leadExternalId,
        username: row['Username'] || row['username'] || row['USERNAME'] || null,
        name: row['Name'] || row['name'] || row['NAME'] || null,
        phone_number: phoneNumber,
        email: row['Email'] || row['email'] || row['EMAIL'] || null,
        work_phone: normalizePhoneNumber(row['Work phone'] || row['work phone'] || row['WORK PHONE'] || null),
        work_email: row['Work email'] || row['work email'] || row['WORK EMAIL'] || null,
        address: row['Address'] || row['address'] || row['ADDRESS'] || null,
        postal_code: row['Postal/zip code'] || row['postal/zip code'] || row['POSTAL/ZIP CODE'] || null,
        city: row['City'] || row['city'] || row['CITY'] || null,
        province_state: row['Province/State'] || row['province/state'] || row['PROVINCE/STATE'] || null,
        country: row['Country'] || row['country'] || row['COUNTRY'] || null,
        gender: row['Gender'] || row['gender'] || row['GENDER'] || null,
        company_name: row['Company name'] || row['company name'] || row['COMPANY NAME'] || null,
        job_title: row['Job title'] || row['job title'] || row['JOB TITLE'] || null,
        first_name: row['First name'] || row['first name'] || row['FIRST NAME'] || null,
        last_name: row['Last name'] || row['last name'] || row['LAST NAME'] || null,
        received_date: receivedDate,
        received_time: receivedTime,
        status: row['Status'] || row['status'] || row['STATUS'] || null,
        source_traffic: row['Source traffic'] || row['source traffic'] || row['SOURCE TRAFFIC'] || null,
        source_action: row['Source action'] || row['source action'] || row['SOURCE ACTION'] || null,
        source_scenario: row['Source scenario'] || row['source scenario'] || row['SOURCE SCENARIO'] || null,
        zalo: row['Zalo'] || row['zalo'] || row['ZALO'] || null,
        line: row['LINE'] || row['line'] || row['LINE'] || null,
        whatsapp: row['WhatsApp'] || row['whatsapp'] || row['WHATSAPP'] || null,
        messenger: row['Messenger'] || row['messenger'] || row['MESSENGER'] || null,
        instagram: row['Instagram'] || row['instagram'] || row['INSTAGRAM'] || null,
        facebook: row['Facebook'] || row['facebook'] || row['FACEBOOK'] || null,
        telegram: row['Telegram'] || row['telegram'] || row['TELEGRAM'] || null,
        snapchat: row['Snapchat'] || row['snapchat'] || row['SNAPCHAT'] || null,
        skype: row['Skype'] || row['skype'] || row['SKYPE'] || null,
        wechat: row['WeChat'] || row['wechat'] || row['WECHAT'] || null,
        kakaotalk: row['KakaoTalk'] || row['kakaotalk'] || row['KAKAOTALK'] || null,
        viber: row['Viber'] || row['viber'] || row['VIBER'] || null,
        twitter: row['Twitter'] || row['twitter'] || row['TWITTER'] || null,
        linkedin: row['LinkedIn'] || row['linkedin'] || row['LINKEDIN'] || null,
        weibo: row['Weibo'] || row['weibo'] || row['WEIBO'] || null,
        tiktok: row['TikTok'] || row['tiktok'] || row['TIKTOK'] || null,
        source_id: sourceId,
      };

      if (existingLeadId) {
        // Update existing lead
        await pool.query(
          `UPDATE him_ttdi.leads SET
            lead_external_id = COALESCE($1, lead_external_id),
            username = COALESCE($2, username),
            name = COALESCE($3, name),
            phone_number = $4,
            email = COALESCE($5, email),
            work_phone = COALESCE($6, work_phone),
            work_email = COALESCE($7, work_email),
            address = COALESCE($8, address),
            postal_code = COALESCE($9, postal_code),
            city = COALESCE($10, city),
            province_state = COALESCE($11, province_state),
            country = COALESCE($12, country),
            gender = COALESCE($13, gender),
            company_name = COALESCE($14, company_name),
            job_title = COALESCE($15, job_title),
            first_name = COALESCE($16, first_name),
            last_name = COALESCE($17, last_name),
            received_date = COALESCE($18, received_date),
            received_time = COALESCE($19, received_time),
            status = COALESCE($20, status),
            source_traffic = COALESCE($21, source_traffic),
            source_action = COALESCE($22, source_action),
            source_scenario = COALESCE($23, source_scenario),
            zalo = COALESCE($24, zalo),
            line = COALESCE($25, line),
            whatsapp = COALESCE($26, whatsapp),
            messenger = COALESCE($27, messenger),
            instagram = COALESCE($28, instagram),
            facebook = COALESCE($29, facebook),
            telegram = COALESCE($30, telegram),
            snapchat = COALESCE($31, snapchat),
            skype = COALESCE($32, skype),
            wechat = COALESCE($33, wechat),
            kakaotalk = COALESCE($34, kakaotalk),
            viber = COALESCE($35, viber),
            twitter = COALESCE($36, twitter),
            linkedin = COALESCE($37, linkedin),
            weibo = COALESCE($38, weibo),
            tiktok = COALESCE($39, tiktok),
            updated_at = NOW()
          WHERE lead_id = $40`,
          [
            leadData.lead_external_id,
            leadData.username,
            leadData.name,
            leadData.phone_number,
            leadData.email,
            leadData.work_phone,
            leadData.work_email,
            leadData.address,
            leadData.postal_code,
            leadData.city,
            leadData.province_state,
            leadData.country,
            leadData.gender,
            leadData.company_name,
            leadData.job_title,
            leadData.first_name,
            leadData.last_name,
            leadData.received_date,
            leadData.received_time,
            leadData.status,
            leadData.source_traffic,
            leadData.source_action,
            leadData.source_scenario,
            leadData.zalo,
            leadData.line,
            leadData.whatsapp,
            leadData.messenger,
            leadData.instagram,
            leadData.facebook,
            leadData.telegram,
            leadData.snapchat,
            leadData.skype,
            leadData.wechat,
            leadData.kakaotalk,
            leadData.viber,
            leadData.twitter,
            leadData.linkedin,
            leadData.weibo,
            leadData.tiktok,
            existingLeadId,
          ]
        );

        // Ensure source assignment exists
        await pool.query(
          `INSERT INTO him_ttdi.lead_source_assignments (lead_id, source_id)
           VALUES ($1, $2)
           ON CONFLICT (lead_id, source_id) DO NOTHING`,
          [existingLeadId, sourceId]
        );

        updated++;
      } else {
        // Insert new lead
        const insertResult = await pool.query(
          `INSERT INTO him_ttdi.leads (
            lead_external_id, username, name, phone_number, email, work_phone, work_email,
            address, postal_code, city, province_state, country, gender, company_name, job_title,
            first_name, last_name, received_date, received_time, status, source_traffic,
            source_action, source_scenario, zalo, line, whatsapp, messenger, instagram, facebook,
            telegram, snapchat, skype, wechat, kakaotalk, viber, twitter, linkedin, weibo, tiktok, source_id
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
            $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36,
            $37, $38, $39, $40
          ) RETURNING lead_id`,
          [
            leadData.lead_external_id,
            leadData.username,
            leadData.name,
            leadData.phone_number,
            leadData.email,
            leadData.work_phone,
            leadData.work_email,
            leadData.address,
            leadData.postal_code,
            leadData.city,
            leadData.province_state,
            leadData.country,
            leadData.gender,
            leadData.company_name,
            leadData.job_title,
            leadData.first_name,
            leadData.last_name,
            leadData.received_date,
            leadData.received_time,
            leadData.status,
            leadData.source_traffic,
            leadData.source_action,
            leadData.source_scenario,
            leadData.zalo,
            leadData.line,
            leadData.whatsapp,
            leadData.messenger,
            leadData.instagram,
            leadData.facebook,
            leadData.telegram,
            leadData.snapchat,
            leadData.skype,
            leadData.wechat,
            leadData.kakaotalk,
            leadData.viber,
            leadData.twitter,
            leadData.linkedin,
            leadData.weibo,
            leadData.tiktok,
            leadData.source_id,
          ]
        );

        const newLeadId = insertResult.rows[0].lead_id;

        // Create source assignment
        await pool.query(
          `INSERT INTO him_ttdi.lead_source_assignments (lead_id, source_id)
           VALUES ($1, $2)
           ON CONFLICT (lead_id, source_id) DO NOTHING`,
          [newLeadId, sourceId]
        );

        inserted++;
      }

      // Handle Tags
      if (tagIds && tagIds.length > 0) {
        // Determine the leadId to tag (either existing or new)
        const targetLeadId = existingLeadId || (await pool.query(
          `SELECT lead_id FROM him_ttdi.leads WHERE phone_number = $1 LIMIT 1`,
          [phoneNumber]
        )).rows[0]?.lead_id;

        if (targetLeadId) {
          for (const tagId of tagIds) {
            await pool.query(
              `INSERT INTO him_ttdi.lead_tag_assignments (lead_id, tag_id)
                      VALUES ($1, $2)
                      ON CONFLICT (lead_id, tag_id) DO NOTHING`,
              [targetLeadId, tagId]
            );
          }
        }
      }

    } catch (error: any) {
      console.error(`[Leads Ingestion] Error processing row:`, error);
      failed++;
    }
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

  for (const row of records) {
    try {
      const phoneNumber = normalizePhoneNumber(row[phoneColumn]);
      const name = row[nameColumn]?.trim() || null;

      // Skip if no phone number (required field)
      if (!phoneNumber) {
        skipped++;
        continue;
      }

      // Check if lead already exists by phone number
      const existingResult = await pool.query(
        `SELECT lead_id FROM him_ttdi.leads WHERE phone_number = $1 LIMIT 1`,
        [phoneNumber]
      );

      let leadId: number;

      if (existingResult.rows.length > 0) {
        // Update existing lead
        leadId = existingResult.rows[0].lead_id;
        await pool.query(
          `UPDATE him_ttdi.leads SET
            name = COALESCE($1, name),
            updated_at = NOW()
          WHERE lead_id = $2`,
          [name, leadId]
        );
        updated++;
      } else {
        // Insert new lead
        const insertResult = await pool.query(
          `INSERT INTO him_ttdi.leads (phone_number, name)
           VALUES ($1, $2)
           RETURNING lead_id`,
          [phoneNumber, name]
        );
        leadId = insertResult.rows[0].lead_id;
        inserted++;
      }

      // Assign tags
      // Current behavior: Tags accumulate (additive)
      // If phone A is uploaded with tag A, then later with tag B,
      // the lead will have BOTH tag A and tag B
      for (const tagId of selectedTagIds) {
        await pool.query(
          `INSERT INTO him_ttdi.lead_tag_assignments (lead_id, tag_id)
           VALUES ($1, $2)
           ON CONFLICT (lead_id, tag_id) DO NOTHING`,
          [leadId, tagId]
        );
      }

      // Assign sources
      // Current behavior: Sources accumulate (additive)
      // If phone A is uploaded with source A, then later with source B,
      // the lead will have BOTH source A and source B
      for (const sourceId of selectedSourceIds) {
        await pool.query(
          `INSERT INTO him_ttdi.lead_source_assignments (lead_id, source_id)
           VALUES ($1, $2)
           ON CONFLICT (lead_id, source_id) DO NOTHING`,
          [leadId, sourceId]
        );
      }

      // Update primary source_id if we have sources
      if (selectedSourceIds.length > 0) {
        await pool.query(
          `UPDATE him_ttdi.leads SET source_id = $1 WHERE lead_id = $2`,
          [selectedSourceIds[0], leadId]
        );
      }
    } catch (error: any) {
      console.error(`[Leads Ingestion] Error processing row:`, error);
      failed++;
    }
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
