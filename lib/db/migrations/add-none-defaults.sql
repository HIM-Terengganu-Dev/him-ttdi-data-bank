-- Add "None" as default source and tag for Wsapme leads
-- This allows leads to have a default source/tag when user doesn't specify

-- Insert "None" source if it doesn't exist
INSERT INTO him_ttdi.lead_sources (source_name) 
VALUES ('None')
ON CONFLICT (source_name) DO NOTHING;

-- Insert "None" tag if it doesn't exist
INSERT INTO him_ttdi.lead_tags (tag_name) 
VALUES ('None')
ON CONFLICT (tag_name) DO NOTHING;
