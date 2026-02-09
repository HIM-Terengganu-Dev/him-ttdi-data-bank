import * as dotenv from 'dotenv';
import { getPool } from '../lib/db/client';

dotenv.config({ path: '.env.local' });

async function verifyTikTokLeads() {
  const pool = getPool();
  try {
    console.log('=== Verifying TikTok Beg Biru Leads ===\n');
    
    // Check total leads
    const totalLeads = await pool.query('SELECT COUNT(*) as count FROM him_ttdi.leads');
    console.log(`Total leads: ${totalLeads.rows[0].count}\n`);
    
    // Check leads with TikTok Beg Biru source
    const tiktokLeads = await pool.query(`
      SELECT 
        l.lead_id,
        l.lead_external_id,
        l.username,
        l.name,
        l.phone_number,
        l.received_date,
        l.received_time,
        l.status,
        l.source_traffic,
        l.source_action,
        l.source_scenario,
        l.created_at,
        ls.source_name,
        l.source_id
      FROM him_ttdi.leads l
      LEFT JOIN him_ttdi.lead_source_assignments lsa ON l.lead_id = lsa.lead_id
      LEFT JOIN him_ttdi.lead_sources ls ON lsa.source_id = ls.source_id
      WHERE ls.source_name = 'Tiktok Beg Biru' OR l.source_id IN (SELECT source_id FROM him_ttdi.lead_sources WHERE source_name = 'Tiktok Beg Biru')
      ORDER BY l.created_at DESC
      LIMIT 10
    `);
    
    console.log(`=== Sample TikTok Beg Biru Leads (latest 10) ===`);
    console.table(tiktokLeads.rows.map(r => ({
      lead_id: r.lead_id,
      external_id: r.lead_external_id,
      username: r.username,
      name: r.name?.substring(0, 30),
      phone: r.phone_number,
      received_date: r.received_date,
      received_time: r.received_time,
      status: r.status,
      source_name: r.source_name,
      source_id: r.source_id,
      created_at: r.created_at
    })));
    
    // Check source assignments
    console.log('\n=== Source Assignments ===');
    const sourceAssignments = await pool.query(`
      SELECT 
        ls.source_name,
        COUNT(DISTINCT lsa.lead_id) as lead_count
      FROM him_ttdi.lead_source_assignments lsa
      JOIN him_ttdi.lead_sources ls ON lsa.source_id = ls.source_id
      GROUP BY ls.source_name
      ORDER BY lead_count DESC
    `);
    console.table(sourceAssignments.rows);
    
    // Check leads without source assignment
    const leadsWithoutSource = await pool.query(`
      SELECT COUNT(*) as count
      FROM him_ttdi.leads l
      WHERE NOT EXISTS (
        SELECT 1 FROM him_ttdi.lead_source_assignments lsa WHERE lsa.lead_id = l.lead_id
      )
    `);
    console.log(`\nLeads without source assignment: ${leadsWithoutSource.rows[0].count}`);
    
    // Check latest upload
    console.log('\n=== Latest Upload ===');
    const latestUpload = await pool.query(`
      SELECT 
        upload_id,
        file_name,
        table_name,
        rows_processed,
        rows_inserted,
        rows_updated,
        rows_failed,
        upload_status,
        uploaded_at,
        error_message
      FROM him_ttdi.csv_uploads
      WHERE table_name = 'leads_tiktok_beg_biru'
      ORDER BY uploaded_at DESC
      LIMIT 1
    `);
    
    if (latestUpload.rows.length > 0) {
      const upload = latestUpload.rows[0];
      console.log(`Upload ID: ${upload.upload_id}`);
      console.log(`File: ${upload.file_name}`);
      console.log(`Status: ${upload.upload_status}`);
      console.log(`Uploaded at (raw): ${upload.uploaded_at}`);
      console.log(`Uploaded at (ISO): ${upload.uploaded_at ? new Date(upload.uploaded_at).toISOString() : 'N/A'}`);
      console.log(`Rows: ${upload.rows_inserted} inserted, ${upload.rows_updated} updated, ${upload.rows_failed} failed`);
    }
    
  } catch (error: any) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

verifyTikTokLeads().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
