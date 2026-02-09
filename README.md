# Remedii Data Ingestion Web Interface

Next.js web application for uploading and ingesting Remedii CSV files into PostgreSQL database.

## Features

- ✅ Drag & drop CSV file upload
- ✅ Automatic file type detection (all 7 Remedii file types)
- ✅ Multiple file upload support
- ✅ Real-time upload progress
- ✅ Latest ingestion report with CSV data dates
- ✅ Professional, responsive UI

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create `.env.local` file with:
```
HIM_WELLNESS_TTDI_DB_DDL=your_connection_string
```

3. Run development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## File Types Supported

1. Patient Details Report → `patients` table
2. Doctor Insights Report (Monthly Consultation) → `consultations` table
3. Doctor Insights Report (Monthly Sales) → `daily_doctor_sales` table
4. Patient Prescription Report (Procedure) → `procedure_prescriptions` table
5. Patient Prescription Report (Medicine) → `medicine_prescriptions` table
6. Itemise Sales Report → `itemized_sales` table
7. Sales Monthly Report by Invoice Date → `invoices` table

## Next Steps

The upload API route currently has placeholder logic. You need to:

1. Refactor `scripts/ingest-csv-data.ts` to export reusable ingestion functions
2. Import and use those functions in `web/app/api/upload/route.ts`
3. Or create a shared ingestion module that both scripts and web app can use

## Project Structure

```
web/
├── app/
│   ├── api/
│   │   ├── upload/          # CSV upload endpoint
│   │   └── latest-ingestion/ # Latest ingestion report
│   └── page.tsx             # Main upload page
├── components/
│   ├── FileDropzone.tsx     # Drag & drop component
│   └── LatestIngestionReport.tsx # Ingestion report
├── lib/
│   ├── db/                   # Database client
│   ├── csv/                  # CSV utilities
│   │   ├── file-detector.ts  # File type detection
│   │   └── date-extractor.ts # Extract dates from CSV
│   └── ingestion/            # Ingestion service
└── .env.local                # Environment variables
```
