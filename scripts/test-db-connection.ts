import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Explicitly load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Use the main DB variable, NOT the DDL one
const connectionString = process.env.HIM_WELLNESS_TTDI_DB;

console.log('Testing connection with string length:', connectionString?.length);
// Don't log full string to avoid leaking secrets, but maybe log user
if (connectionString) {
    const hidden = connectionString.replace(/:[^:]*@/, ':****@');
    console.log('Connection String (redacted):', hidden);
}

if (!connectionString) {
    console.error('HIM_WELLNESS_TTDI_DB not found!');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false } // Try adding this if sslmode=require acts up
});

async function testConnection() {
    try {
        const res = await pool.query('SELECT NOW() as now');
        console.log('Connection successful!', res.rows[0]);
    } catch (e: any) {
        console.error('Connection failed:', e.message);
        if (e.code) console.error('Error Code:', e.code);
    } finally {
        await pool.end();
    }
}

testConnection();
