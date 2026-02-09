/**
 * Run leads tables migration
 * Execute this script to create the leads tables in the database
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { getPool } from '../lib/db/client';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function runMigration() {
  const pool = getPool();
  
  try {
    console.log('Running leads tables migration...');
    
    // Read migration SQL file
    const migrationPath = path.join(__dirname, '../lib/db/migrations/create-leads-tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Execute migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('Created tables:');
    console.log('  - him_ttdi.lead_tags');
    console.log('  - him_ttdi.lead_sources');
    console.log('  - him_ttdi.leads');
    console.log('  - him_ttdi.lead_tag_assignments');
    console.log('  - him_ttdi.lead_source_assignments');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
