# Integration Note

## Current Status

The UI is complete with:
- ✅ Drag & drop file upload
- ✅ Automatic file type detection
- ✅ Latest ingestion report
- ✅ Professional UI

## TODO: Integrate Actual Ingestion Logic

The upload API route (`web/app/api/upload/route.ts`) currently has placeholder logic. You need to integrate with the actual ingestion functions from `scripts/ingest-csv-data.ts`.

### Option 1: Extract Shared Module (Recommended)

1. Create `lib/shared/ingestion/` folder
2. Extract ingestion functions from `scripts/ingest-csv-data.ts`:
   - `ingestPatientDetails()`
   - `ingestConsultations()`
   - `ingestProcedurePrescriptions()`
   - `ingestMedicinePrescriptions()`
   - `ingestInvoices()`
   - `ingestItemizedSales()`
   - `ingestDailyDoctorSales()`
3. Make them accept file content/records instead of file paths
4. Import and use in both:
   - `scripts/ingest-csv-data.ts` (for CLI)
   - `web/app/api/upload/route.ts` (for web)

### Option 2: Call Script via Child Process

Use Node.js child process to call the existing script, but this is less efficient.

### Quick Integration Example

In `web/app/api/upload/route.ts`, replace the placeholder with:

```typescript
import { ingestPatientDetails } from '@/lib/shared/ingestion/patients';
// ... other imports

// Then in the upload handler:
let ingestionResult;
switch (detected.type) {
  case 'patient_details':
    ingestionResult = await ingestPatientDetails(pool, records, uploadId);
    break;
  case 'consultation':
    ingestionResult = await ingestConsultations(pool, records, uploadId);
    break;
  // ... etc
}
```

## Testing

1. Start the dev server: `npm run dev`
2. Upload a CSV file
3. Check the database for ingested data
4. Verify the latest ingestion report shows correct dates
