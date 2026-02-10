import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const pool = new Pool({
  connectionString: process.env.HIM_WELLNESS_TTDI_DB,
});

async function testAgeCalculation() {
  try {
    console.log('Testing age calculation precision...\n');
    console.log('PostgreSQL AGE() function calculates age based on actual date difference.\n');

    // Test with some example dates
    const testCases = [
      { name: 'Born today (same date)', dob: '2024-01-15', today: '2024-01-15' },
      { name: 'Born yesterday', dob: '2024-01-14', today: '2024-01-15' },
      { name: 'Born 1 year ago today', dob: '2023-01-15', today: '2024-01-15' },
      { name: 'Born 1 year ago yesterday', dob: '2023-01-14', today: '2024-01-15' },
      { name: 'Born 25 years ago today', dob: '1999-01-15', today: '2024-01-15' },
      { name: 'Born 25 years ago yesterday', dob: '1999-01-14', today: '2024-01-15' },
      { name: 'Born 25 years ago tomorrow', dob: '1999-01-16', today: '2024-01-15' },
    ];

    console.log('Test Cases (using CURRENT_DATE as reference):');
    console.log('=============================================\n');

    for (const testCase of testCases) {
      const result = await pool.query(`
        SELECT 
          $1::date as date_of_birth,
          CURRENT_DATE as today,
          AGE($1::date)::text as age_interval,
          EXTRACT(YEAR FROM AGE($1::date))::INTEGER as age_years,
          EXTRACT(DAY FROM AGE($1::date))::INTEGER as age_days
      `, [testCase.dob]);

      const row = result.rows[0];
      console.log(`${testCase.name}:`);
      console.log(`  DOB: ${row.date_of_birth}`);
      console.log(`  Today: ${row.today}`);
      console.log(`  Age Interval: ${row.age_interval}`);
      console.log(`  Age (years): ${row.age_years}`);
      console.log(`  Days component: ${row.age_days}`);
      console.log('');
    }

    // Test with actual patient data
    console.log('\nReal Patient Examples:');
    console.log('=====================\n');
    
    const patients = await pool.query(`
      SELECT 
        patient_id,
        name,
        date_of_birth,
        CURRENT_DATE as today,
        AGE(date_of_birth)::text as age_interval,
        EXTRACT(YEAR FROM AGE(date_of_birth))::INTEGER as calculated_age
      FROM him_ttdi.patients
      WHERE date_of_birth IS NOT NULL
      ORDER BY date_of_birth DESC
      LIMIT 5
    `);

    patients.rows.forEach(patient => {
      console.log(`Patient: ${patient.name}`);
      console.log(`  DOB: ${patient.date_of_birth}`);
      console.log(`  Today: ${patient.today}`);
      console.log(`  Age Interval: ${patient.age_interval}`);
      console.log(`  Calculated Age: ${patient.calculated_age} years`);
      console.log('');
    });

    console.log('\n==========================================');
    console.log('CONCLUSION:');
    console.log('==========================================');
    console.log('The AGE() function calculates age based on the ACTUAL DATE DIFFERENCE.');
    console.log('This means age changes on the person\'s BIRTHDAY, not on New Year\'s Day.');
    console.log('EXTRACT(YEAR FROM AGE(...)) extracts the year component, but the');
    console.log('underlying calculation is still accurate to days.');
    console.log('==========================================');

  } catch (error: any) {
    console.error('Error testing age calculation:', error);
  } finally {
    await pool.end();
  }
}

testAgeCalculation();
