-- Create leads tables for HIM Wellness TTDI
-- This migration creates tables for leads, tags, sources, and their relationships

-- Create tags table
CREATE TABLE IF NOT EXISTS him_ttdi.lead_tags (
  tag_id SERIAL PRIMARY KEY,
  tag_name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create sources table
CREATE TABLE IF NOT EXISTS him_ttdi.lead_sources (
  source_id SERIAL PRIMARY KEY,
  source_name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create leads table
CREATE TABLE IF NOT EXISTS him_ttdi.leads (
  lead_id SERIAL PRIMARY KEY,
  lead_external_id VARCHAR(255), -- External ID from source (e.g., Lead ID from TikTok)
  username VARCHAR(255),
  name VARCHAR(500),
  phone_number VARCHAR(50),
  email VARCHAR(255),
  work_phone VARCHAR(50),
  work_email VARCHAR(255),
  address TEXT,
  postal_code VARCHAR(50),
  city VARCHAR(255),
  province_state VARCHAR(255),
  country VARCHAR(255),
  gender VARCHAR(50),
  company_name VARCHAR(255),
  job_title VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  
  -- TikTok Beg Biru specific fields
  received_date DATE,
  received_time TIME,
  status VARCHAR(100),
  source_traffic VARCHAR(100),
  source_action VARCHAR(100),
  source_scenario VARCHAR(100),
  
  -- Social media fields
  zalo VARCHAR(255),
  line VARCHAR(255),
  whatsapp VARCHAR(255),
  messenger VARCHAR(255),
  instagram VARCHAR(255),
  facebook VARCHAR(255),
  telegram VARCHAR(255),
  snapchat VARCHAR(255),
  skype VARCHAR(255),
  wechat VARCHAR(255),
  kakaotalk VARCHAR(255),
  viber VARCHAR(255),
  twitter VARCHAR(255),
  linkedin VARCHAR(255),
  weibo VARCHAR(255),
  tiktok VARCHAR(255),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create many-to-many relationship: lead_tags junction table
CREATE TABLE IF NOT EXISTS him_ttdi.lead_tag_assignments (
  assignment_id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES him_ttdi.leads(lead_id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES him_ttdi.lead_tags(tag_id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_lead_tag UNIQUE (lead_id, tag_id)
);

-- Create many-to-many relationship: lead_sources junction table
CREATE TABLE IF NOT EXISTS him_ttdi.lead_source_assignments (
  assignment_id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES him_ttdi.leads(lead_id) ON DELETE CASCADE,
  source_id INTEGER NOT NULL REFERENCES him_ttdi.lead_sources(source_id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_lead_source UNIQUE (lead_id, source_id)
);

-- Add foreign key constraint to leads table for source_id (for direct source reference)
-- Note: We'll use the junction table for multiple sources, but this can be used for primary source
ALTER TABLE him_ttdi.leads 
ADD COLUMN IF NOT EXISTS source_id INTEGER REFERENCES him_ttdi.lead_sources(source_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_phone ON him_ttdi.leads(phone_number);
CREATE INDEX IF NOT EXISTS idx_leads_email ON him_ttdi.leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_external_id ON him_ttdi.leads(lead_external_id);
CREATE INDEX IF NOT EXISTS idx_leads_source_id ON him_ttdi.leads(source_id);
CREATE INDEX IF NOT EXISTS idx_lead_tag_assignments_lead ON him_ttdi.lead_tag_assignments(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_tag_assignments_tag ON him_ttdi.lead_tag_assignments(tag_id);
CREATE INDEX IF NOT EXISTS idx_lead_source_assignments_lead ON him_ttdi.lead_source_assignments(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_source_assignments_source ON him_ttdi.lead_source_assignments(source_id);

-- Insert default source for TikTok Beg Biru
INSERT INTO him_ttdi.lead_sources (source_name) 
VALUES ('Tiktok Beg Biru')
ON CONFLICT (source_name) DO NOTHING;
