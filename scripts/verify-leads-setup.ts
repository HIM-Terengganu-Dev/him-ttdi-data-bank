/**
 * Verify leads setup - check tables and default data
 */

import * as dotenv from 'dotenv';
import { getPool } from '../lib/db/client';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function verifySetup() {
  const pool = getPool();
  
  try {
    console.log('Verifying leads setup...\n');
    
    // Check default source
    const sourceResult = await pool.query(
      `SELECT source_id, source_name FROM him_ttdi.lead_sources WHERE source_name = 'Tiktok Beg Biru'`
    );
    
    if (sourceResult.rows.length > 0) {
      console.log('✅ Default source "Tiktok Beg Biru" exists');
      console.log(`   Source ID: ${sourceResult.rows[0].source_id}`);
    } else {
      console.log('⚠️  Default source "Tiktok Beg Biru" not found');
    }
    
    // Count all sources
    const allSourcesResult = await pool.query(
      `SELECT COUNT(*) as count FROM him_ttdi.lead_sources`
    );
    console.log(`\n📊 Total sources: ${allSourcesResult.rows[0].count}`);
    
    // Count all tags
    const allTagsResult = await pool.query(
      `SELECT COUNT(*) as count FROM him_ttdi.lead_tags`
    );
    console.log(`📊 Total tags: ${allTagsResult.rows[0].count}`);
    
    // Count all leads
    const allLeadsResult = await pool.query(
      `SELECT COUNT(*) as count FROM him_ttdi.leads`
    );
    console.log(`📊 Total leads: ${allLeadsResult.rows[0].count}`);
    
    console.log('\n✅ Setup verification complete!');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

verifySetup().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
