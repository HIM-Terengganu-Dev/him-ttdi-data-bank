import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function fixStuckReports() {
  const connectionString = process.env.HIM_WELLNESS_TTDI_DB_DDL;
  const client = new Client({ connectionString });

  try {
    await client.connect();
    
    console.log('Checking for stuck uploads in him_ttdi.csv_uploads...');
    const result = await client.query(`
      SELECT 
        upload_id,
        file_name,
        table_name,
        upload_status,
        uploaded_at
      FROM him_ttdi.csv_uploads 
      WHERE upload_status = 'processing' OR upload_status = 'queued'
      ORDER BY uploaded_at DESC;
    `);
    
    if (result.rows.length > 0) {
      console.log(`\nFound ${result.rows.length} stuck uploads:`);
      console.table(result.rows);
      
      console.log('\nFixing stuck uploads by setting them to "failed"...');
      const updateResult = await client.query(`
        UPDATE him_ttdi.csv_uploads
        SET upload_status = 'failed',
            error_message = 'Failed due to timeout or server restart'
        WHERE upload_status = 'processing' OR upload_status = 'queued'
        RETURNING upload_id, file_name, upload_status;
      `);
      
      console.log(`Successfully fixed ${updateResult.rowCount} rows:`);
      console.table(updateResult.rows);
    } else {
      console.log('No stuck uploads found.');
    }

  } catch (error) {
    console.error('❌ Query failed!');
    console.error(error);
  } finally {
    await client.end();
  }
}

fixStuckReports();
