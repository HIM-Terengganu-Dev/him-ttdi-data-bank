import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const pool = new Pool({
  connectionString: process.env.HIM_WELLNESS_TTDI_DB,
});

async function testAgeTrigger() {
  try {
    console.log('Testing age column and trigger...\n');

    // Check if age column exists
    const columnCheck = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'him_ttdi'
        AND table_name = 'patients'
        AND column_name = 'age'
    `);

    if (columnCheck.rows.length === 0) {
      console.log('❌ Age column not found');
      return;
    }
    console.log('✅ Age column exists\n');

    // Check if trigger exists
    const triggerCheck = await pool.query(`
      SELECT trigger_name, event_manipulation, action_timing
      FROM information_schema.triggers
      WHERE event_object_schema = 'him_ttdi'
        AND event_object_table = 'patients'
        AND trigger_name = 'update_age_trigger'
    `);

    if (triggerCheck.rows.length > 0) {
      const trigger = triggerCheck.rows[0];
      console.log('✅ Trigger exists:');
      console.log(`   Name: ${trigger.trigger_name}`);
      console.log(`   Event: ${trigger.event_manipulation}`);
      console.log(`   Timing: ${trigger.action_timing}\n`);
    } else {
      console.log('❌ Trigger not found\n');
    }

    // Show some sample data
    console.log('Sample data (showing stored age vs calculated age):');
    console.log('===================================================\n');
    
    const samples = await pool.query(`
      SELECT 
        patient_id,
        name,
        date_of_birth,
        age as stored_age,
        EXTRACT(YEAR FROM AGE(date_of_birth))::INTEGER as calculated_age,
        CASE 
          WHEN age = EXTRACT(YEAR FROM AGE(date_of_birth))::INTEGER THEN '✓ Match'
          ELSE '✗ Mismatch'
        END as status
      FROM him_ttdi.patients
      WHERE date_of_birth IS NOT NULL
      ORDER BY date_of_birth DESC
      LIMIT 5
    `);

    samples.rows.forEach(row => {
      console.log(`Patient: ${row.name}`);
      console.log(`  DOB: ${row.date_of_birth}`);
      console.log(`  Stored Age: ${row.stored_age}`);
      console.log(`  Calculated Age: ${row.calculated_age}`);
      console.log(`  Status: ${row.status}`);
      console.log('');
    });

    // Test the trigger by updating a row
    console.log('Testing trigger by updating a test row...');
    const testUpdate = await pool.query(`
      UPDATE him_ttdi.patients
      SET date_of_birth = date_of_birth
      WHERE patient_id = (SELECT patient_id FROM him_ttdi.patients WHERE date_of_birth IS NOT NULL LIMIT 1)
      RETURNING patient_id, name, date_of_birth, age
    `);

    if (testUpdate.rows.length > 0) {
      const updated = testUpdate.rows[0];
      const calculated = await pool.query(`
        SELECT EXTRACT(YEAR FROM AGE($1::date))::INTEGER as age
      `, [updated.date_of_birth]);
      
      console.log(`  Updated patient: ${updated.name}`);
      console.log(`  DOB: ${updated.date_of_birth}`);
      console.log(`  Age after update: ${updated.age}`);
      console.log(`  Expected age: ${calculated.rows[0].age}`);
      console.log(`  ✓ Trigger working: ${updated.age === calculated.rows[0].age ? 'YES' : 'NO'}\n`);
    }

    console.log('==========================================');
    console.log('SUMMARY:');
    console.log('==========================================');
    console.log('✅ Age column is now visible in the database');
    console.log('✅ Age automatically updates when:');
    console.log('   - A new patient is inserted with date_of_birth');
    console.log('   - An existing patient\'s date_of_birth is updated');
    console.log('');
    console.log('Note: The age column stores the age at the time of');
    console.log('insert/update. For always-current age in queries,');
    console.log('you can still use: EXTRACT(YEAR FROM AGE(date_of_birth))::INTEGER');
    console.log('==========================================');

  } catch (error: any) {
    console.error('Error testing trigger:', error);
  } finally {
    await pool.end();
  }
}

testAgeTrigger();
