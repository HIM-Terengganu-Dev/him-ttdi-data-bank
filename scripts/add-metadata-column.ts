import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.HIM_WELLNESS_TTDI_DB_DDL;

if (!connectionString) {
    process.exit(1);
}

const pool = new Pool({ connectionString });

async function migrate() {
    try {
        console.log('Adding metadata column to csv_uploads...');
        await pool.query(`
      ALTER TABLE him_ttdi.csv_uploads
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
    `);
        console.log('Migration successful');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await pool.end();
    }
}

migrate();
