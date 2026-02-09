import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.HIM_WELLNESS_TTDI_DB_DDL;
const pool = new Pool({ connectionString });

async function checkUploads() {
    try {
        const res = await pool.query(`
      SELECT upload_id, file_name, table_name, upload_status, rows_processed, uploaded_at 
      FROM him_ttdi.csv_uploads 
      WHERE file_name LIKE '%Beg Biru%'
      ORDER BY uploaded_at DESC 
      LIMIT 5
    `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

checkUploads();
