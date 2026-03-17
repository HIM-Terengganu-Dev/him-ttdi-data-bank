/**
 * Run WABOT tables migration
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { getPool } from '../lib/db/client';

dotenv.config({ path: '.env.local' });

async function runMigration() {
  const pool = getPool();
  
  try {
    console.log('Running WABOT tables migration...');
    
    const migrationPath = path.join(__dirname, '../lib/db/migrations/create-wabot-table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('Created table: him_ttdi.wabot_blasts');
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
