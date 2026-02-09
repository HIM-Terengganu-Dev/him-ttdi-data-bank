-- Remove file_path column from csv_uploads table
-- This column is no longer needed since we process files directly from memory

ALTER TABLE him_ttdi.csv_uploads
DROP COLUMN IF EXISTS file_path;
