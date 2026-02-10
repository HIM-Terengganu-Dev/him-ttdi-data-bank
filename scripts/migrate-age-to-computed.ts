import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const pool = new Pool({
  connectionString: process.env.HIM_WELLNESS_TTDI_DB_DDL || process.env.HIM_WELLNESS_TTDI_DB,
});

async function migrateAgeToComputed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Removing age column - age will be calculated dynamically from date_of_birth...\n');

    // Drop the existing age column
    // Age will be calculated dynamically in queries using: EXTRACT(YEAR FROM AGE(date_of_birth))::INTEGER
    console.log('Dropping age column...');
    await client.query(`
      ALTER TABLE him_ttdi.patients 
      DROP COLUMN IF EXISTS age
    `);
    console.log('✓ Dropped age column\n');

    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!');
    console.log('\nAge will now be calculated dynamically from date_of_birth in all queries.');
    console.log('This ensures age is always accurate and up-to-date.');

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateAgeToComputed();
