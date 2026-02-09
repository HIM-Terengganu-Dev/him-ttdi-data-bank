import * as dotenv from 'dotenv';
import { getPool } from '../lib/db/client';

dotenv.config({ path: '.env.local' });

async function checkPhoneMatching() {
  const pool = getPool();
  try {
    console.log('=== Checking Phone Number Matching ===\n');
    
    // Get sample phone numbers from both tables
    const leadsSample = await pool.query(`
      SELECT phone_number, name 
      FROM him_ttdi.leads 
      LIMIT 5
    `);
    
    const patientsSample = await pool.query(`
      SELECT phone_no, name 
      FROM him_ttdi.patients 
      LIMIT 5
    `);
    
    console.log('Sample Leads:');
    leadsSample.rows.forEach(row => {
      console.log(`  Phone: "${row.phone_number}", Name: "${row.name}"`);
    });
    
    console.log('\nSample Patients:');
    patientsSample.rows.forEach(row => {
      console.log(`  Phone: "${row.phone_no}", Name: "${row.name}"`);
    });
    
    // Try matching with different approaches
    console.log('\n=== Matching Test ===');
    
    // Direct match
    const directMatch = await pool.query(`
      SELECT COUNT(*) as count
      FROM him_ttdi.leads l
      INNER JOIN him_ttdi.patients p ON l.phone_number = p.phone_no
    `);
    console.log(`Direct match (l.phone_number = p.phone_no): ${directMatch.rows[0].count}`);
    
    // Match with REPLACE (remove spaces, dashes)
    const normalizedMatch = await pool.query(`
      SELECT COUNT(*) as count
      FROM him_ttdi.leads l
      INNER JOIN him_ttdi.patients p 
        ON REPLACE(REPLACE(REPLACE(l.phone_number, ' ', ''), '-', ''), '+', '') = 
           REPLACE(REPLACE(REPLACE(p.phone_no, ' ', ''), '-', ''), '+', '')
    `);
    console.log(`Normalized match (removing spaces, dashes, +): ${normalizedMatch.rows[0].count}`);
    
    // Match with regex (digits only)
    const digitsOnlyMatch = await pool.query(`
      SELECT COUNT(*) as count
      FROM him_ttdi.leads l
      INNER JOIN him_ttdi.patients p 
        ON REGEXP_REPLACE(l.phone_number, '[^0-9]', '', 'g') = 
           REGEXP_REPLACE(p.phone_no, '[^0-9]', '', 'g')
    `);
    console.log(`Digits only match (regex): ${digitsOnlyMatch.rows[0].count}`);
    
  } catch (error: any) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

checkPhoneMatching().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
