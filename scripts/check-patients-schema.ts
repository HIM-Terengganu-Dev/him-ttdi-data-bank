import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const pool = new Pool({
  connectionString: process.env.HIM_WELLNESS_TTDI_DB,
});

async function checkSchema() {
  try {
    console.log('Checking patients table schema...\n');

    // Get all columns in patients table
    const columns = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'him_ttdi'
        AND table_name = 'patients'
      ORDER BY ordinal_position
    `);

    console.log('Current columns in him_ttdi.patients:');
    console.log('=====================================');
    columns.rows.forEach(col => {
      console.log(`- ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${col.column_default ? `DEFAULT: ${col.column_default}` : ''}`);
    });
    console.log('');

    // Check if age column exists
    const ageColumn = columns.rows.find(col => col.column_name === 'age');
    if (ageColumn) {
      console.log('❌ Age column still exists in the database');
    } else {
      console.log('✅ Age column does NOT exist (as expected)');
      console.log('   Age is now calculated dynamically from date_of_birth');
    }
    console.log('');

    // Show how to get age in queries
    console.log('To get age in queries, use:');
    console.log('  EXTRACT(YEAR FROM AGE(date_of_birth))::INTEGER AS age');
    console.log('');
    console.log('Example query:');
    console.log('  SELECT name, date_of_birth,');
    console.log('         EXTRACT(YEAR FROM AGE(date_of_birth))::INTEGER AS age');
    console.log('  FROM him_ttdi.patients');
    console.log('  WHERE date_of_birth IS NOT NULL');
    console.log('  LIMIT 5;');
    console.log('');

    // Show example with actual data
    const example = await pool.query(`
      SELECT 
        name,
        date_of_birth,
        EXTRACT(YEAR FROM AGE(date_of_birth))::INTEGER AS calculated_age
      FROM him_ttdi.patients
      WHERE date_of_birth IS NOT NULL
      LIMIT 5
    `);

    console.log('Example results:');
    console.log('===============');
    example.rows.forEach(row => {
      console.log(`Name: ${row.name}`);
      console.log(`  DOB: ${row.date_of_birth}`);
      console.log(`  Age (calculated): ${row.calculated_age} years`);
      console.log('');
    });

  } catch (error: any) {
    console.error('Error checking schema:', error);
  } finally {
    await pool.end();
  }
}

checkSchema();
