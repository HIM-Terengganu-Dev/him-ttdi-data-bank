import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const pool = new Pool({
  connectionString: process.env.HIM_WELLNESS_TTDI_DB_DDL || process.env.HIM_WELLNESS_TTDI_DB,
});

async function addAgeColumnWithTrigger() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Adding age column with automatic update trigger...\n');

    // Step 1: Add age column back (if it doesn't exist)
    console.log('Step 1: Adding age column...');
    await client.query(`
      ALTER TABLE him_ttdi.patients 
      ADD COLUMN IF NOT EXISTS age INTEGER
    `);
    console.log('✓ Added age column\n');

    // Step 2: Create function to calculate age from date_of_birth
    console.log('Step 2: Creating function to calculate age...');
    await client.query(`
      CREATE OR REPLACE FUNCTION him_ttdi.calculate_age()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.date_of_birth IS NOT NULL THEN
          NEW.age := EXTRACT(YEAR FROM AGE(NEW.date_of_birth))::INTEGER;
        ELSE
          NEW.age := NULL;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✓ Created calculate_age() function\n');

    // Step 3: Create trigger to automatically update age on INSERT or UPDATE
    console.log('Step 3: Creating trigger...');
    await client.query(`
      DROP TRIGGER IF EXISTS update_age_trigger ON him_ttdi.patients;
    `);
    await client.query(`
      CREATE TRIGGER update_age_trigger
      BEFORE INSERT OR UPDATE OF date_of_birth ON him_ttdi.patients
      FOR EACH ROW
      EXECUTE FUNCTION him_ttdi.calculate_age();
    `);
    console.log('✓ Created trigger\n');

    // Step 4: Update existing rows with calculated age
    console.log('Step 4: Updating existing rows with calculated age...');
    const updateResult = await client.query(`
      UPDATE him_ttdi.patients
      SET age = EXTRACT(YEAR FROM AGE(date_of_birth))::INTEGER
      WHERE date_of_birth IS NOT NULL
    `);
    console.log(`✓ Updated ${updateResult.rowCount} existing rows\n`);

    await client.query('COMMIT');
    console.log('✅ Successfully added age column with automatic update trigger!');
    console.log('\nThe age column will now:');
    console.log('  - Automatically calculate when date_of_birth is inserted');
    console.log('  - Automatically update when date_of_birth is changed');
    console.log('  - Always reflect the current age based on date_of_birth');
    console.log('\nNote: Age will update when the row is modified. For always-current');
    console.log('age without modifying rows, you can still use the calculated expression');
    console.log('in queries: EXTRACT(YEAR FROM AGE(date_of_birth))::INTEGER');

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addAgeColumnWithTrigger();
