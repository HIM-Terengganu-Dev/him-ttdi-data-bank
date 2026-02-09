/**
 * Check if leads tables exist in the database
 */

import * as dotenv from 'dotenv';
import { getPool } from '../lib/db/client';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function checkTables() {
  const pool = getPool();
  
  try {
    console.log('Checking for leads tables in him_ttdi schema...\n');
    
    const tables = [
      'lead_tags',
      'lead_sources',
      'leads',
      'lead_tag_assignments',
      'lead_source_assignments'
    ];
    
    const results: { table: string; exists: boolean }[] = [];
    
    for (const table of tables) {
      try {
        const result = await pool.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'him_ttdi' 
            AND table_name = $1
          )`,
          [table]
        );
        
        const exists = result.rows[0].exists;
        results.push({ table, exists });
        
        console.log(`${exists ? '✅' : '❌'} him_ttdi.${table} - ${exists ? 'EXISTS' : 'NOT FOUND'}`);
      } catch (error: any) {
        console.error(`❌ Error checking ${table}:`, error.message);
        results.push({ table, exists: false });
      }
    }
    
    const allExist = results.every(r => r.exists);
    
    console.log('\n' + '='.repeat(50));
    if (allExist) {
      console.log('✅ All leads tables exist in the database!');
    } else {
      console.log('❌ Some tables are missing. Run the migration:');
      console.log('   npm run migrate:leads');
      console.log('   or');
      console.log('   npx tsx scripts/run-leads-migration.ts');
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

checkTables().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
