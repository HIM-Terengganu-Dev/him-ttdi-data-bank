import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.HIM_WELLNESS_TTDI_DB_DDL || process.env.HIM_WELLNESS_TTDI_DB;
const pool = new Pool({ connectionString });

async function check() {
    try {
        const res = await pool.query(`
      SELECT upload_id, file_name, table_name, upload_status, rows_processed, uploaded_at 
      FROM him_ttdi.csv_uploads 
      WHERE file_name LIKE '%Leads Beg Biru%' OR file_name LIKE '%Beg Biru%'
      ORDER BY uploaded_at DESC 
      LIMIT 10
    `);
        const outputPath = path.join(process.cwd(), 'debug-uploads.json');
        fs.writeFileSync(outputPath, JSON.stringify(res.rows, null, 2));
        console.log('Written to debug-uploads.json');
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

check();
