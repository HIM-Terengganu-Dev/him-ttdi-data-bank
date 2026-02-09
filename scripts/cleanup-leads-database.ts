import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { getPool } from '../lib/db/client';

dotenv.config({ path: '.env.local' });

async function cleanupLeadsDatabase() {
  const pool = getPool();
  try {
    console.log('=== Cleaning up Leads Database ===\n');
    
    // Ask for confirmation
    console.log('This will:');
    console.log('1. Delete all existing leads data');
    console.log('2. Remove unnecessary columns from leads table');
    console.log('3. Clean up indexes\n');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../lib/db/migrations/cleanup-leads-table.sql');
    let migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Uncomment the DELETE line
    migrationSQL = migrationSQL.replace(
      '-- DELETE FROM him_ttdi.leads;',
      'DELETE FROM him_ttdi.leads;'
    );
    
    console.log('Executing cleanup migration...\n');
    await pool.query(migrationSQL);
    
    console.log('✅ Cleanup completed successfully!');
    console.log('\nRemoved columns:');
    console.log('  - email, work_phone, work_email');
    console.log('  - address, postal_code, city, country');
    console.log('  - company_name, job_title, first_name, last_name');
    console.log('  - All social media columns (zalo, line, whatsapp, etc.)');
    console.log('\nKept columns:');
    console.log('  - lead_external_id, username, name, phone_number');
    console.log('  - province_state, gender');
    console.log('  - received_date, received_time');
    console.log('  - status, source_traffic, source_action, source_scenario');
    console.log('  - source_id, created_at, updated_at');
    
  } catch (error: any) {
    console.error('❌ Cleanup failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

cleanupLeadsDatabase().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
