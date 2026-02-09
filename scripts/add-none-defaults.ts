import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { getPool } from '../lib/db/client';

dotenv.config({ path: '.env.local' });

async function addNoneDefaults() {
  const pool = getPool();
  try {
    console.log('Adding "None" as default source and tag...');
    const migrationPath = path.join(__dirname, '../lib/db/migrations/add-none-defaults.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    await pool.query(migrationSQL);
    console.log('✅ Migration completed successfully!');
    console.log('Created defaults:');
    console.log('  - "None" source (if not exists)');
    console.log('  - "None" tag (if not exists)');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

addNoneDefaults().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
