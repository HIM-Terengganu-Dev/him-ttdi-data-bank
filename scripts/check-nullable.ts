import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.HIM_WELLNESS_TTDI_DB_DDL;

if (!connectionString) {
    console.error('No connection string found');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
});

async function checkNullable() {
    try {
        const res = await pool.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'him_ttdi' 
      AND table_name = 'lead_source_assignments'
      AND column_name = 'source_id'
    `);
        console.log('SOURCE_ID NULLABLE:', res.rows[0]?.is_nullable);

        const leadsRes = await pool.query(`
        SELECT column_name, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'him_ttdi'
        AND table_name = 'leads'
        AND column_name = 'source_id'
    `);
        console.log('LEADS.SOURCE_ID NULLABLE:', leadsRes.rows[0]?.is_nullable);

    } catch (error) {
        console.error(error);
    } finally {
        await pool.end();
    }
}

checkNullable();
