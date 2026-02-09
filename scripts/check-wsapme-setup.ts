import * as dotenv from 'dotenv';
import { getPool } from '../lib/db/client';

dotenv.config({ path: '.env.local' });

async function checkWsapmeSetup() {
  const pool = getPool();
  try {
    console.log('=== Checking Wsapme Setup ===\n');
    
    // Check existing sources
    const sources = await pool.query('SELECT * FROM him_ttdi.lead_sources ORDER BY source_name');
    console.log('Current Sources:');
    sources.rows.forEach(s => {
      console.log(`  - ${s.source_name} (ID: ${s.source_id})`);
    });
    
    // Check if "None" source exists
    const noneSource = sources.rows.find(s => s.source_name.toLowerCase() === 'none');
    if (!noneSource) {
      console.log('\n⚠️  "None" source does not exist - will need to create it');
    } else {
      console.log(`\n✅ "None" source exists (ID: ${noneSource.source_id})`);
    }
    
    // Check existing tags
    const tags = await pool.query('SELECT * FROM him_ttdi.lead_tags ORDER BY tag_name');
    console.log('\nCurrent Tags:');
    if (tags.rows.length === 0) {
      console.log('  (no tags)');
    } else {
      tags.rows.forEach(t => {
        console.log(`  - ${t.tag_name} (ID: ${t.tag_id})`);
      });
    }
    
    // Check if "None" tag exists
    const noneTag = tags.rows.find(t => t.tag_name.toLowerCase() === 'none');
    if (!noneTag) {
      console.log('\n⚠️  "None" tag does not exist - will need to create it');
    } else {
      console.log(`\n✅ "None" tag exists (ID: ${noneTag.tag_id})`);
    }
    
    // Check if "Wsapme" exists as a source (it shouldn't)
    const wsapmeSource = sources.rows.find(s => s.source_name.toLowerCase().includes('wsapme'));
    if (wsapmeSource) {
      console.log(`\n⚠️  "Wsapme" found as source (ID: ${wsapmeSource.source_id}) - should be removed or renamed`);
    } else {
      console.log('\n✅ "Wsapme" is not a source (correct)');
    }
    
    console.log('\n=== Recommendations ===');
    console.log('1. Create "None" source if it doesn\'t exist');
    console.log('2. Create "None" tag if it doesn\'t exist');
    console.log('3. Ensure Wsapme ingestion defaults to "None" if no source/tag selected');
    console.log('4. Update UI to make it clear that source/tag can be "None"');
    
  } catch (error: any) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

checkWsapmeSetup().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
