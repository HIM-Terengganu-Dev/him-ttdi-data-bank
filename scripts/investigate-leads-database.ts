import * as dotenv from 'dotenv';
import { getPool } from '../lib/db/client';

dotenv.config({ path: '.env.local' });

async function investigateLeadsDatabase() {
  const pool = getPool();
  try {
    console.log('=== Investigating Leads Database Structure ===\n');
    
    // 1. Check leads table structure
    console.log('1. Leads Table Structure:');
    const leadsStructure = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'him_ttdi' AND table_name = 'leads'
      ORDER BY ordinal_position
    `);
    console.table(leadsStructure.rows.map(r => ({
      column: r.column_name,
      type: r.data_type,
      nullable: r.is_nullable
    })));
    
    // 2. Check patients table structure
    console.log('\n2. Patients Table Structure:');
    const patientsStructure = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'him_ttdi' AND table_name = 'patients'
      ORDER BY ordinal_position
    `);
    console.table(patientsStructure.rows.map(r => ({
      column: r.column_name,
      type: r.data_type,
      nullable: r.is_nullable
    })));
    
    // 3. Check how to match leads to patients
    console.log('\n3. Checking Lead-Patient Matching:');
    const matchingResult = await pool.query(`
      SELECT 
        COUNT(DISTINCT l.lead_id) as total_leads,
        COUNT(DISTINCT CASE WHEN p.patient_id IS NOT NULL THEN l.lead_id END) as existing_patients,
        COUNT(DISTINCT CASE WHEN p.patient_id IS NULL THEN l.lead_id END) as non_patients
      FROM him_ttdi.leads l
      LEFT JOIN him_ttdi.patients p ON l.phone_number = p.phone_no
    `);
    console.log('Lead-Patient Matching:');
    console.log(`  Total Leads: ${matchingResult.rows[0].total_leads}`);
    console.log(`  Existing Patients: ${matchingResult.rows[0].existing_patients}`);
    console.log(`  Non-Patients: ${matchingResult.rows[0].non_patients}`);
    
    // 4. Check available sources
    console.log('\n4. Available Sources:');
    const sources = await pool.query(`
      SELECT source_name, COUNT(DISTINCT lsa.lead_id) as lead_count
      FROM him_ttdi.lead_sources ls
      LEFT JOIN him_ttdi.lead_source_assignments lsa ON ls.source_id = lsa.source_id
      GROUP BY source_name
      ORDER BY lead_count DESC
    `);
    console.table(sources.rows);
    
    // 5. Check available tags
    console.log('\n5. Available Tags:');
    const tags = await pool.query(`
      SELECT tag_name, COUNT(DISTINCT lta.lead_id) as lead_count
      FROM him_ttdi.lead_tags lt
      LEFT JOIN him_ttdi.lead_tag_assignments lta ON lt.tag_id = lta.tag_id
      GROUP BY tag_name
      ORDER BY lead_count DESC
    `);
    console.table(tags.rows);
    
    // 6. Check patient age distribution (for existing patients)
    console.log('\n6. Patient Age Distribution (for existing patients):');
    const ageDistribution = await pool.query(`
      WITH age_groups AS (
        SELECT 
          CASE 
            WHEN p.age IS NULL THEN 'Unknown'
            WHEN p.age < 18 THEN 'Under 18'
            WHEN p.age BETWEEN 18 AND 25 THEN '18-25'
            WHEN p.age BETWEEN 26 AND 35 THEN '26-35'
            WHEN p.age BETWEEN 36 AND 45 THEN '36-45'
            WHEN p.age BETWEEN 46 AND 55 THEN '46-55'
            WHEN p.age BETWEEN 56 AND 65 THEN '56-65'
            WHEN p.age > 65 THEN 'Over 65'
          END as age_group,
          COUNT(DISTINCT l.lead_id) as lead_count
        FROM him_ttdi.leads l
        JOIN him_ttdi.patients p ON l.phone_number = p.phone_no
        GROUP BY 
          CASE 
            WHEN p.age IS NULL THEN 'Unknown'
            WHEN p.age < 18 THEN 'Under 18'
            WHEN p.age BETWEEN 18 AND 25 THEN '18-25'
            WHEN p.age BETWEEN 26 AND 35 THEN '26-35'
            WHEN p.age BETWEEN 36 AND 45 THEN '36-45'
            WHEN p.age BETWEEN 46 AND 55 THEN '46-55'
            WHEN p.age BETWEEN 56 AND 65 THEN '56-65'
            WHEN p.age > 65 THEN 'Over 65'
          END
      )
      SELECT * FROM age_groups
      ORDER BY 
        CASE age_group
          WHEN 'Under 18' THEN 1
          WHEN '18-25' THEN 2
          WHEN '26-35' THEN 3
          WHEN '36-45' THEN 4
          WHEN '46-55' THEN 5
          WHEN '56-65' THEN 6
          WHEN 'Over 65' THEN 7
          WHEN 'Unknown' THEN 8
        END
    `);
    console.table(ageDistribution.rows);
    
    // 7. Check gender distribution
    console.log('\n7. Gender Distribution:');
    const genderDistribution = await pool.query(`
      SELECT 
        COALESCE(p.gender, l.gender, 'Unknown') as gender,
        COUNT(DISTINCT l.lead_id) as lead_count
      FROM him_ttdi.leads l
      LEFT JOIN him_ttdi.patients p ON l.phone_number = p.phone_no
      GROUP BY COALESCE(p.gender, l.gender, 'Unknown')
      ORDER BY lead_count DESC
    `);
    console.table(genderDistribution.rows);
    
    // 8. Check province/state distribution
    console.log('\n8. Province/State Distribution:');
    const provinceDistribution = await pool.query(`
      SELECT 
        COALESCE(l.province_state, 'Unknown') as province_state,
        COUNT(DISTINCT l.lead_id) as lead_count
      FROM him_ttdi.leads l
      GROUP BY l.province_state
      ORDER BY lead_count DESC
      LIMIT 10
    `);
    console.table(provinceDistribution.rows);
    
    // 9. Check date ranges
    console.log('\n9. Date Ranges:');
    const dateRanges = await pool.query(`
      SELECT 
        MIN(l.created_at::date) as earliest_lead,
        MAX(l.created_at::date) as latest_lead,
        MIN(p.first_visit_date) as earliest_patient_visit,
        MAX(p.first_visit_date) as latest_patient_visit
      FROM him_ttdi.leads l
      LEFT JOIN him_ttdi.patients p ON l.phone_number = p.phone_no
    `);
    console.log('Lead Creation Dates:');
    console.log(`  Earliest: ${dateRanges.rows[0].earliest_lead}`);
    console.log(`  Latest: ${dateRanges.rows[0].latest_lead}`);
    console.log('Patient Visit Dates (for existing patients):');
    console.log(`  Earliest: ${dateRanges.rows[0].earliest_patient_visit || 'N/A'}`);
    console.log(`  Latest: ${dateRanges.rows[0].latest_patient_visit || 'N/A'}`);
    
    // 10. Check TikTok Beg Biru specific fields
    console.log('\n10. TikTok Beg Biru Fields Usage:');
    const tiktokFields = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE l.received_date IS NOT NULL) as has_received_date,
        COUNT(*) FILTER (WHERE l.received_time IS NOT NULL) as has_received_time,
        COUNT(*) FILTER (WHERE l.status IS NOT NULL) as has_status,
        COUNT(*) FILTER (WHERE l.source_traffic IS NOT NULL) as has_source_traffic,
        COUNT(*) FILTER (WHERE l.source_action IS NOT NULL) as has_source_action,
        COUNT(*) FILTER (WHERE l.source_scenario IS NOT NULL) as has_source_scenario
      FROM him_ttdi.leads l
    `);
    console.table([
      { field: 'received_date', count: tiktokFields.rows[0].has_received_date },
      { field: 'received_time', count: tiktokFields.rows[0].has_received_time },
      { field: 'status', count: tiktokFields.rows[0].has_status },
      { field: 'source_traffic', count: tiktokFields.rows[0].has_source_traffic },
      { field: 'source_action', count: tiktokFields.rows[0].has_source_action },
      { field: 'source_scenario', count: tiktokFields.rows[0].has_source_scenario },
    ]);
    
    console.log('\n=== Suggested Filters ===');
    console.log('\nFor Existing Patients:');
    console.log('  - Age range (min/max)');
    console.log('  - Gender');
    console.log('  - Province/State');
    console.log('  - First visit date range');
    console.log('  - Visit count range');
    console.log('  - Source');
    console.log('  - Tags');
    
    console.log('\nFor Non-Patients:');
    console.log('  - Source (required - multiple selection)');
    console.log('  - Tags (optional - multiple selection)');
    console.log('  - Province/State (from TikTok Beg Biru)');
    console.log('  - Gender (from TikTok Beg Biru)');
    console.log('  - Lead creation date range');
    console.log('  - Status (from TikTok Beg Biru)');
    console.log('  - Source traffic/action/scenario (from TikTok Beg Biru)');
    
  } catch (error: any) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

investigateLeadsDatabase().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
