# Leads Data Ingestion

This document describes the leads data ingestion feature for the Data Bank Dashboard.

## Overview

The leads ingestion system supports two types of lead sources:
1. **TikTok Beg Biru** - Standard format with consistent headers
2. **Wsapme** - Variable headers, only requires "phone" and "name" columns

## Database Setup

Before using the leads ingestion feature, you need to run the database migration:

```bash
cd web
npx tsx scripts/run-leads-migration.ts
```

This will create the following tables:
- `him_ttdi.lead_tags` - Tags for categorizing leads
- `him_ttdi.lead_sources` - Sources of leads
- `him_ttdi.leads` - Main leads table
- `him_ttdi.lead_tag_assignments` - Many-to-many relationship between leads and tags
- `him_ttdi.lead_source_assignments` - Many-to-many relationship between leads and sources

## Features

### TikTok Beg Biru Leads

- **Source**: Always set to "Tiktok Beg Biru" (automatically created in database)
- **Tags**: No default tags
- **Format**: Standard CSV with consistent headers matching the "Leads Beg Biru.csv" format
- **Detection**: Automatically detected by presence of "Lead ID", "Username", "Received date", "Phone number", and "Name" columns

### Wsapme Leads

- **Source**: User must select at least one source (required)
- **Tags**: User can optionally select multiple tags
- **Format**: CSV with variable headers, only requires "phone" and "name" columns (case-insensitive)
- **Detection**: Detected when file has "phone" and "name" columns but doesn't match TikTok Beg Biru format

## Usage

### Via Web Interface

1. Navigate to the "Leads Data" tab in the dashboard
2. Drag and drop your leads CSV files
3. For Wsapme files:
   - Select one or more sources (required)
   - Optionally select tags
   - Add new tags or sources if needed using the "Add Tag" or "Add Source" buttons
4. Click "Upload All" to process the files

### File Formats

#### TikTok Beg Biru Format

Expected columns (case-insensitive):
- Lead ID
- Username
- Received date
- Received time
- Status
- Source traffic
- Source action
- Source scenario
- Name
- Phone number
- Email
- And other standard columns...

#### Wsapme Format

Minimum required columns:
- `phone` (or `phonenumber` or `phone number`) - Required
- `name` - Required

All other columns are optional and will be ignored.

## API Endpoints

### Tags

- `GET /api/tags` - Get all tags
- `POST /api/tags` - Create a new tag
  ```json
  {
    "tagName": "New Tag Name"
  }
  ```

### Sources

- `GET /api/sources` - Get all sources
- `POST /api/sources` - Create a new source
  ```json
  {
    "sourceName": "New Source Name"
  }
  ```

### Upload Leads

- `POST /api/upload-leads` - Upload leads files
  - Form data:
    - `files`: Array of File objects
    - `tagIds`: JSON array of tag IDs (optional)
    - `sourceIds`: JSON array of source IDs (required for Wsapme)

## Data Model

### Leads Table

Stores all lead information including:
- Contact information (phone, email, name, etc.)
- Location information (address, city, province, country)
- Social media handles
- TikTok Beg Biru specific fields (received date, status, etc.)

### Tags and Sources

- A lead can have multiple tags
- A lead can have multiple sources
- Tags and sources are managed independently and can be reused across leads

## Notes

- Phone numbers are normalized (spaces and dashes removed)
- Duplicate leads are detected by:
  - External ID + Source (for TikTok Beg Biru)
  - Phone number (for all leads)
- Existing leads are updated with new information when found
- The "Tiktok Beg Biru" source is automatically created in the database
