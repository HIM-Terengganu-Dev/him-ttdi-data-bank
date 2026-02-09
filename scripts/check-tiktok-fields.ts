import * as dotenv from 'dotenv';
import { getPool } from '../lib/db/client';

dotenv.config({ path: '.env.local' });

async function checkTikTokFields() {
  const pool = getPool();
  try {
    console.log('Checking which fields are populated for TikTok Beg Biru leads...\n');
    
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_leads,
        COUNT(lead_external_id) as has_external_id,
        COUNT(username) as has_username,
        COUNT(name) as has_name,
        COUNT(phone_number) as has_phone,
        COUNT(email) as has_email,
        COUNT(work_phone) as has_work_phone,
        COUNT(work_email) as has_work_email,
        COUNT(address) as has_address,
        COUNT(postal_code) as has_postal_code,
        COUNT(city) as has_city,
        COUNT(province_state) as has_province_state,
        COUNT(country) as has_country,
        COUNT(gender) as has_gender,
        COUNT(company_name) as has_company_name,
        COUNT(job_title) as has_job_title,
        COUNT(first_name) as has_first_name,
        COUNT(last_name) as has_last_name,
        COUNT(received_date) as has_received_date,
        COUNT(received_time) as has_received_time,
        COUNT(status) as has_status,
        COUNT(source_traffic) as has_source_traffic,
        COUNT(source_action) as has_source_action,
        COUNT(source_scenario) as has_source_scenario,
        COUNT(zalo) as has_zalo,
        COUNT(line) as has_line,
        COUNT(whatsapp) as has_whatsapp,
        COUNT(messenger) as has_messenger,
        COUNT(instagram) as has_instagram,
        COUNT(facebook) as has_facebook,
        COUNT(telegram) as has_telegram,
        COUNT(snapchat) as has_snapchat,
        COUNT(skype) as has_skype,
        COUNT(wechat) as has_wechat,
        COUNT(kakaotalk) as has_kakaotalk,
        COUNT(viber) as has_viber,
        COUNT(twitter) as has_twitter,
        COUNT(linkedin) as has_linkedin,
        COUNT(weibo) as has_weibo,
        COUNT(tiktok) as has_tiktok
      FROM him_ttdi.leads
      WHERE source_id IN (SELECT source_id FROM him_ttdi.lead_sources WHERE source_name = 'Tiktok Beg Biru')
    `);

    const row = result.rows[0];
    const total = parseInt(row.total_leads);
    
    console.log(`Total TikTok Beg Biru leads: ${total}\n`);
    console.log('Field usage (count of non-null values):\n');
    
    const fields = [
      'lead_external_id', 'username', 'name', 'phone_number', 'email',
      'work_phone', 'work_email', 'address', 'postal_code', 'city',
      'province_state', 'country', 'gender', 'company_name', 'job_title',
      'first_name', 'last_name', 'received_date', 'received_time', 'status',
      'source_traffic', 'source_action', 'source_scenario',
      'zalo', 'line', 'whatsapp', 'messenger', 'instagram', 'facebook',
      'telegram', 'snapchat', 'skype', 'wechat', 'kakaotalk', 'viber',
      'twitter', 'linkedin', 'weibo', 'tiktok'
    ];
    
    const relevantFields: string[] = [];
    
    for (const field of fields) {
      const count = parseInt(row[`has_${field}`] || '0');
      const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
      const status = count > 0 ? '✓' : '✗';
      console.log(`${status} ${field.padEnd(25)} ${count.toString().padStart(5)} (${percentage}%)`);
      
      if (count > 0) {
        relevantFields.push(field);
      }
    }
    
    console.log('\n=== Relevant Fields (non-empty) ===');
    console.log(relevantFields.join(', '));
    
  } catch (error: any) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

checkTikTokFields().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
