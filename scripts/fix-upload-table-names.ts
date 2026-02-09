import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.HIM_WELLNESS_TTDI_DB_DDL || process.env.HIM_WELLNESS_TTDI_DB;
const pool = new Pool({ connectionString });

async function fixTableNames() {
    try {
        // Fix TikTok Beg Biru
        const res1 = await pool.query(`
      UPDATE him_ttdi.csv_uploads
      SET table_name = 'leads_tiktok_beg_biru'
      WHERE table_name = 'leads' 
      AND (file_name LIKE '%Beg Biru%' OR file_name LIKE '%TikTok%')
    `);
        console.log(`Updated ${res1.rowCount} rows for TikTok Beg Biru`);

        // Fix Wsapme
        const res2 = await pool.query(`
      UPDATE him_ttdi.csv_uploads
      SET table_name = 'leads_wsapme'
      WHERE table_name = 'leads' 
      AND (file_name LIKE '%wsapme%' OR file_name LIKE '%Wsapme%')
    `);
        console.log(`Updated ${res2.rowCount} rows for Wsapme`);

        // Fix Device Export
        const res3 = await pool.query(`
      UPDATE him_ttdi.csv_uploads
      SET table_name = 'leads_device_export'
      WHERE table_name = 'leads' 
      AND (file_name LIKE 'DEVICE_%')
    `);
        console.log(`Updated ${res3.rowCount} rows for Device Export`);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

fixTableNames();
