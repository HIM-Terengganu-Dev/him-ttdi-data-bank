import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const pool = new Pool({
  connectionString: process.env.HIM_WELLNESS_TTDI_DB,
});

async function checkAgeColumn() {
  try {
    console.log('Checking if patients.age is a calculated field...\n');

    // Check column definition and if it's a generated column
    const columnInfo = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        is_generated,
        generation_expression
      FROM information_schema.columns
      WHERE table_schema = 'him_ttdi'
        AND table_name = 'patients'
        AND column_name = 'age'
    `);

    if (columnInfo.rows.length === 0) {
      console.log('❌ age column not found in patients table');
      return;
    }

    const ageCol = columnInfo.rows[0];
    console.log('Column Information:');
    console.log('==================');
    console.log(`Column Name: ${ageCol.column_name}`);
    console.log(`Data Type: ${ageCol.data_type}`);
    console.log(`Is Nullable: ${ageCol.is_nullable}`);
    console.log(`Column Default: ${ageCol.column_default || 'NULL'}`);
    console.log(`Is Generated: ${ageCol.is_generated || 'NO'}`);
    console.log(`Generation Expression: ${ageCol.generation_expression || 'NULL'}`);
    console.log('');

    // Check table definition using pg_catalog for more details
    const tableDef = await pool.query(`
      SELECT 
        attname as column_name,
        atttypid::regtype as data_type,
        attgenerated as is_generated,
        pg_get_expr(adbin, adrelid) as generation_expression
      FROM pg_attribute a
      LEFT JOIN pg_attrdef ad ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
      WHERE a.attrelid = 'him_ttdi.patients'::regclass
        AND a.attname = 'age'
        AND NOT a.attisdropped
    `);

    if (tableDef.rows.length > 0) {
      const def = tableDef.rows[0];
      console.log('Detailed Column Definition:');
      console.log('===========================');
      console.log(`Column Name: ${def.column_name}`);
      console.log(`Data Type: ${def.data_type}`);
      console.log(`Is Generated: ${def.is_generated || 'NO'}`);
      console.log(`Generation Expression: ${def.generation_expression || 'NULL'}`);
      console.log('');
    }

    // Check if there's a trigger or function that calculates age
    const triggers = await pool.query(`
      SELECT 
        trigger_name,
        event_manipulation,
        action_statement
      FROM information_schema.triggers
      WHERE event_object_schema = 'him_ttdi'
        AND event_object_table = 'patients'
        AND action_statement LIKE '%age%'
    `);

    if (triggers.rows.length > 0) {
      console.log('Triggers that might calculate age:');
      console.log('==================================');
      triggers.rows.forEach(trigger => {
        console.log(`Trigger: ${trigger.trigger_name}`);
        console.log(`Event: ${trigger.event_manipulation}`);
        console.log(`Statement: ${trigger.action_statement}`);
        console.log('');
      });
    } else {
      console.log('No triggers found that calculate age');
      console.log('');
    }

    // Sample some actual data to see if age values exist
    const sampleData = await pool.query(`
      SELECT 
        patient_id,
        name,
        age,
        date_of_birth
      FROM him_ttdi.patients
      WHERE age IS NOT NULL
      LIMIT 5
    `);

    console.log('Sample Data (patients with age):');
    console.log('================================');
    if (sampleData.rows.length > 0) {
      sampleData.rows.forEach(row => {
        console.log(`ID: ${row.patient_id}, Name: ${row.name}, Age: ${row.age}, DOB: ${row.date_of_birth || 'NULL'}`);
      });
    } else {
      console.log('No patients with age values found');
    }
    console.log('');

    // Check if age can be calculated from date_of_birth
    const ageFromDob = await pool.query(`
      SELECT 
        patient_id,
        name,
        age,
        date_of_birth,
        CASE 
          WHEN date_of_birth IS NOT NULL 
          THEN EXTRACT(YEAR FROM AGE(date_of_birth))::INTEGER
          ELSE NULL
        END as calculated_age
      FROM him_ttdi.patients
      WHERE date_of_birth IS NOT NULL
      LIMIT 5
    `);

    console.log('Age Comparison (stored vs calculated from DOB):');
    console.log('===============================================');
    if (ageFromDob.rows.length > 0) {
      ageFromDob.rows.forEach(row => {
        const match = row.age === row.calculated_age ? '✓' : '✗';
        console.log(`${match} ID: ${row.patient_id}, Stored Age: ${row.age}, Calculated: ${row.calculated_age}, DOB: ${row.date_of_birth}`);
      });
    } else {
      console.log('No patients with date_of_birth found');
    }

    // Final conclusion
    console.log('\n==========================================');
    if (ageCol.is_generated === 'ALWAYS' || ageCol.is_generated === 'BY DEFAULT') {
      console.log('✅ CONCLUSION: age is a GENERATED/COMPUTED column');
      console.log(`   Expression: ${ageCol.generation_expression || 'N/A'}`);
    } else if (ageCol.column_default && ageCol.column_default.includes('AGE')) {
      console.log('✅ CONCLUSION: age has a DEFAULT value that might calculate it');
      console.log(`   Default: ${ageCol.column_default}`);
    } else {
      console.log('✅ CONCLUSION: age is a REGULAR STORED column (not calculated)');
      console.log('   Age values are stored directly in the database');
    }
    console.log('==========================================');

  } catch (error) {
    console.error('Error checking age column:', error);
  } finally {
    await pool.end();
  }
}

checkAgeColumn();
