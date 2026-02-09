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

async function inspectSchema() {
    try {
        console.log('Inspecting him_ttdi.leads table...');
        const leadsCols = await pool.query(`
      SELECT column_name, is_nullable, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'him_ttdi' AND table_name = 'leads'
    `);
        console.log(JSON.stringify(leadsCols.rows, null, 2));

        console.log('\nInspecting him_ttdi.lead_source_assignments table...');
        const sourceAssignmentsCols = await pool.query(`
      SELECT column_name, is_nullable, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'him_ttdi' AND table_name = 'lead_source_assignments'
    `);
        console.log(JSON.stringify(sourceAssignmentsCols.rows, null, 2));

        console.log('\nInspecting him_ttdi.lead_tag_assignments table...');
        const tagAssignmentsCols = await pool.query(`
      SELECT column_name, is_nullable, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'him_ttdi' AND table_name = 'lead_tag_assignments'
    `);
        console.log(JSON.stringify(tagAssignmentsCols.rows, null, 2));

    } catch (error) {
        console.error('Error inspecting schema:', error);
    } finally {
        await pool.end();
    }
}

inspectSchema();
