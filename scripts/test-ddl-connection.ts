import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Test the DDL connection string specifically
const connectionString = process.env.HIM_WELLNESS_TTDI_DB_DDL;

console.log('Testing DDL connection...');

if (!connectionString) {
    console.error('HIM_WELLNESS_TTDI_DB_DDL not found!');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function testConnection() {
    try {
        const res = await pool.query('SELECT NOW() as now');
        console.log('DDL Connection successful!', res.rows[0]);
    } catch (e: any) {
        console.error('DDL Connection failed:', e.message);
    } finally {
        await pool.end();
    }
}

testConnection();
