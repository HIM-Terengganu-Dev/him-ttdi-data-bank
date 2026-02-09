-- Cleanup leads table: Remove unnecessary columns and optionally clear data
-- This migration removes all empty/unused columns to simplify the schema

-- Step 1: Delete existing leads data (optional - user approved)
-- Uncomment the line below if you want to clear existing leads
-- DELETE FROM him_ttdi.leads;

-- Step 2: Remove unnecessary columns that are never populated
-- These columns are always empty based on database analysis
ALTER TABLE him_ttdi.leads 
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS work_phone,
  DROP COLUMN IF EXISTS work_email,
  DROP COLUMN IF EXISTS address,
  DROP COLUMN IF EXISTS postal_code,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS country,
  DROP COLUMN IF EXISTS company_name,
  DROP COLUMN IF EXISTS job_title,
  DROP COLUMN IF EXISTS first_name,
  DROP COLUMN IF EXISTS last_name,
  DROP COLUMN IF EXISTS zalo,
  DROP COLUMN IF EXISTS line,
  DROP COLUMN IF EXISTS whatsapp,
  DROP COLUMN IF EXISTS messenger,
  DROP COLUMN IF EXISTS instagram,
  DROP COLUMN IF EXISTS facebook,
  DROP COLUMN IF EXISTS telegram,
  DROP COLUMN IF EXISTS snapchat,
  DROP COLUMN IF EXISTS skype,
  DROP COLUMN IF EXISTS wechat,
  DROP COLUMN IF EXISTS kakaotalk,
  DROP COLUMN IF EXISTS viber,
  DROP COLUMN IF EXISTS twitter,
  DROP COLUMN IF EXISTS linkedin,
  DROP COLUMN IF EXISTS weibo,
  DROP COLUMN IF EXISTS tiktok;

-- Note: lead_external_id and phone_number are kept even if currently empty
-- because they may be used in future or for matching purposes
-- If you want to remove them too, uncomment below:
-- ALTER TABLE him_ttdi.leads 
--   DROP COLUMN IF EXISTS lead_external_id,
--   DROP COLUMN IF EXISTS phone_number;

-- Step 3: Ensure indexes are still valid (they should be automatically updated)
-- Recreate indexes if needed
DROP INDEX IF EXISTS him_ttdi.idx_leads_email;
DROP INDEX IF EXISTS him_ttdi.idx_leads_phone;

-- Keep only relevant indexes
CREATE INDEX IF NOT EXISTS idx_leads_external_id ON him_ttdi.leads(lead_external_id) WHERE lead_external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_phone ON him_ttdi.leads(phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_source_id ON him_ttdi.leads(source_id) WHERE source_id IS NOT NULL;
