import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkRecentUploads() {
  const connectionString = process.env.HIM_WELLNESS_TTDI_DB_DDL;
  const client = new Client({ connectionString });

  try {
    await client.connect();
    
    console.log('Checking recent uploads in him_ttdi.csv_uploads...');
    const result = await client.query(`
      SELECT 
        upload_id,
        file_name,
        table_name,
        upload_status,
        rows_processed,
        rows_inserted,
        rows_failed,
        error_message,
        uploaded_at
      FROM him_ttdi.csv_uploads 
      ORDER BY uploaded_at DESC
      LIMIT 10;
    `);
    
    if (result.rows.length > 0) {
      console.log(`\nFound ${result.rows.length} recent uploads:`);
      console.table(result.rows);
    } else {
      console.log('No recent uploads found.');
    }

  } catch (error) {
    console.error('❌ Query failed!');
    console.error(error);
  } finally {
    await client.end();
  }
}

checkRecentUploads();
