/**
 * Script to remove file_path column from csv_uploads table
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const connectionString = process.env.HIM_WELLNESS_TTDI_DB_DDL;

if (!connectionString) {
  console.error('Error: HIM_WELLNESS_TTDI_DB_DDL environment variable not set');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function removeFilePathColumn() {
  try {
    console.log('Removing file_path column from csv_uploads table...');
    
    await pool.query(`
      ALTER TABLE him_ttdi.csv_uploads
      DROP COLUMN IF EXISTS file_path;
    `);
    
    console.log('✅ Successfully removed file_path column');
  } catch (error: any) {
    console.error('❌ Error removing file_path column:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

removeFilePathColumn();
