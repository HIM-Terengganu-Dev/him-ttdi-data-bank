import { Pool } from 'pg';

/**
 * Helper to convert Unix timestamp to standard Date/ISO string for PostgreSQL
 * If value is "0", empty, or invalid, returns null.
 */
function parseTimestamp(val: any): string | null {
  if (!val || val === '0' || val === 0) return null;
  const num = parseInt(val, 10);
  if (isNaN(num)) return null;
  
  // Assuming the WABOT provides timestamps in seconds based on typical blast tools.
  // If it's in milliseconds, the number length > 12 typically. 
  // Let's handle both.
  const ms = num > 9999999999 ? num : num * 1000;
  return new Date(ms).toISOString();
}

/**
 * Ingest WABOT Blast Data
 */
export async function ingestWabotBlastData(
  pool: Pool,
  records: Record<string, any>[]
): Promise<{ inserted: number; updated: number; failed: number; skipped?: number }> {
  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (const record of records) {
    try {
      const id = record['ID'] || record['id'];
      const uid = record['UID'] || record['uid'];
      const receiver = record['RECEIVER'] || record['receiver'];
      const status = record['STATUS'] || record['status'];
      
      const sent = parseTimestamp(record['SENT'] || record['sent']);
      const delivered = parseTimestamp(record['DELIVERED'] || record['delivered']);
      const read = parseTimestamp(record['READ'] || record['read']);
      const replied = parseTimestamp(record['REPLIED'] || record['replied']);
      
      const failedRaw = record['FAILED'] || record['failed'];
      const isFailed = failedRaw === '1' || failedRaw === 'true' || failedRaw === true;
      
      const errorStr = record['ERROR'] || record['error'] || null;

      if (!id) {
        failed++;
        continue;
      }

      const result = await pool.query(
        `INSERT INTO him_ttdi.wabot_blasts 
         (id, uid, receiver, status, sent, delivered, read, replied, failed, error)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         sent = EXCLUDED.sent,
         delivered = EXCLUDED.delivered,
         read = EXCLUDED.read,
         replied = EXCLUDED.replied,
         failed = EXCLUDED.failed,
         error = EXCLUDED.error
         RETURNING (xmax = 0) AS inserted;`,
        [id, uid, receiver, status, sent, delivered, read, replied, isFailed, errorStr]
      );

      // xmax = 0 means true insertion, greater than 0 means update
      if (result.rows[0].inserted) {
        inserted++;
      } else {
        updated++;
      }
    } catch (err: any) {
      console.error(`Error processing WABOT record:`, err.message);
      failed++;
    }
  }

  return { inserted, updated, failed };
}
