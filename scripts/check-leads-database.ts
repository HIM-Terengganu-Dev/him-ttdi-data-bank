import * as dotenv from 'dotenv';
import { getPool } from '../lib/db/client';

dotenv.config({ path: '.env.local' });

async function checkLeadsDatabase() {
  const pool = getPool();
  try {
    console.log('=== Checking Leads Database ===\n');
    
    // Check total leads
    const totalLeads = await pool.query('SELECT COUNT(*) as count FROM him_ttdi.leads');
    console.log(`Total leads: ${totalLeads.rows[0].count}\n`);
    
    // Check source assignments
    console.log('=== Source Assignments ===');
    const sourceAssignments = await pool.query(`
      SELECT ls.source_name, COUNT(DISTINCT lsa.lead_id) as lead_count
      FROM him_ttdi.lead_source_assignments lsa
      JOIN him_ttdi.lead_sources ls ON lsa.source_id = ls.source_id
      GROUP BY ls.source_name
      ORDER BY lead_count DESC
    `);
    console.table(sourceAssignments.rows);
    
    // Check leads with source_id directly set
    const leadsWithSource = await pool.query(`
      SELECT ls.source_name, COUNT(*) as count
      FROM him_ttdi.leads l
      JOIN him_ttdi.lead_sources ls ON l.source_id = ls.source_id
      GROUP BY ls.source_name
    `);
    if (leadsWithSource.rows.length > 0) {
      console.log('\n=== Leads with direct source_id ===');
      console.table(leadsWithSource.rows);
    }
    
    // Check leads without any source assignment
    const leadsWithoutSource = await pool.query(`
      SELECT COUNT(*) as count
      FROM him_ttdi.leads l
      WHERE NOT EXISTS (
        SELECT 1 FROM him_ttdi.lead_source_assignments lsa WHERE lsa.lead_id = l.lead_id
      )
    `);
    console.log(`\nLeads without source assignment: ${leadsWithoutSource.rows[0].count}`);
    
    // Check which columns have data (only remaining columns)
    console.log('\n=== Column Usage (non-null counts) ===');
    const columnUsage = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(lead_external_id) as has_external_id,
        COUNT(username) as has_username,
        COUNT(name) as has_name,
        COUNT(phone_number) as has_phone,
        COUNT(province_state) as has_province_state,
        COUNT(gender) as has_gender,
        COUNT(received_date) as has_received_date,
        COUNT(received_time) as has_received_time,
        COUNT(status) as has_status,
        COUNT(source_traffic) as has_source_traffic,
        COUNT(source_action) as has_source_action,
        COUNT(source_scenario) as has_source_scenario
      FROM him_ttdi.leads
    `);
    
    const row = columnUsage.rows[0];
    const total = parseInt(row.total);
    const fields = [
      'lead_external_id', 'username', 'name', 'phone_number',
      'province_state', 'gender', 'received_date', 'received_time',
      'status', 'source_traffic', 'source_action', 'source_scenario'
    ];
    
    console.log(`Total leads: ${total}\n`);
    for (const field of fields) {
      const count = parseInt(row[`has_${field}`] || '0');
      const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
      const status = count > 0 ? '✓' : '✗';
      console.log(`${status} ${field.padEnd(25)} ${count.toString().padStart(5)} (${percentage}%)`);
    }
    
    // Check table structure
    console.log('\n=== Table Structure ===');
    const tableStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'him_ttdi' AND table_name = 'leads'
      ORDER BY ordinal_position
    `);
    console.table(tableStructure.rows.map(r => ({
      column: r.column_name,
      type: r.data_type,
      nullable: r.is_nullable
    })));
    
  } catch (error: any) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

checkLeadsDatabase().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
