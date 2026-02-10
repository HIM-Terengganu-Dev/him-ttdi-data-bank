# Ingestion Idempotency Status

## Overview
All ingestion functions are designed to be **idempotent** - meaning they can be run multiple times safely without creating duplicates or causing data corruption.

## Idempotency Mechanisms

### 1. **Patient Details** ✅
- **Mechanism**: SELECT check + UPDATE/INSERT
- **Key**: `phone_no`
- **Status**: Idempotent - Updates existing patients, inserts new ones

### 2. **Consultations** ✅
- **Mechanism**: `ON CONFLICT (patient_id, doctor_id, visit_date, visit_time) DO UPDATE SET`
- **Unique Constraint**: `consultations_unique_visit`
- **Status**: Idempotent - Updates existing consultations on conflict

### 3. **Procedure Prescriptions** ✅
- **Mechanism**: `ON CONFLICT (patient_id, prescribing_doctor_id, prescription_date, procedure_code) DO UPDATE SET`
- **Unique Constraint**: `procedure_prescriptions_unique`
- **Status**: Idempotent - Updates existing prescriptions on conflict

### 4. **Medicine Prescriptions** ✅
- **Mechanism**: `ON CONFLICT (patient_id, prescribing_doctor_id, prescription_date, medicine_code) DO UPDATE SET`
- **Unique Constraint**: `medicine_prescriptions_unique`
- **Status**: Idempotent - Updates existing prescriptions on conflict

### 5. **Invoices** ✅
- **Mechanism**: `ON CONFLICT (invoice_code) DO UPDATE SET`
- **Unique Constraint**: `invoice_code UNIQUE` (built-in)
- **Status**: Idempotent - Updates existing invoices on conflict

### 6. **Itemized Sales** ✅
- **Mechanism**: `ON CONFLICT (invoice_code) DO UPDATE SET`
- **Unique Constraint**: `itemized_sales_unique_invoice`
- **Status**: Idempotent - Updates existing sales on conflict

### 7. **Daily Doctor Sales** ✅
- **Mechanism**: `ON CONFLICT (sale_date, doctor_id) DO UPDATE SET`
- **Unique Constraint**: `UNIQUE(sale_date, doctor_id)` (built-in)
- **Status**: Idempotent - Updates existing daily sales on conflict

### 8. **Leads (TikTok Beg Biru)** ✅
- **Mechanism**: Complex logic with phone number matching + `ON CONFLICT DO NOTHING` for assignments
- **Key**: `phone_number` + `lead_external_id` + `source_id`
- **Status**: Idempotent - Updates existing leads, preserves existing sources/tags

### 9. **Leads (Wsapme)** ✅
- **Mechanism**: Phone number matching + `ON CONFLICT DO NOTHING` for assignments
- **Key**: `phone_number`
- **Status**: Idempotent - Updates existing leads, preserves existing sources/tags

## Database Constraints

All tables have appropriate unique constraints enforced at the database level:
- Consultations: `(patient_id, doctor_id, visit_date, visit_time)`
- Procedure Prescriptions: `(patient_id, prescribing_doctor_id, prescription_date, procedure_code)`
- Medicine Prescriptions: `(patient_id, prescribing_doctor_id, prescription_date, medicine_code)`
- Itemized Sales: `(invoice_code)`
- Invoices: `(invoice_code)`
- Daily Doctor Sales: `(sale_date, doctor_id)`
- Patients: `(phone_no)` - used for matching
- Doctors: `(doctor_name)` - UNIQUE

## Safety Features

1. **ON CONFLICT Handling**: All transaction tables use PostgreSQL's `ON CONFLICT` clause
2. **COALESCE for Updates**: Prevents overwriting existing data with NULL values
3. **Phone Number Normalization**: Ensures consistent matching across uploads
4. **Source/Tag Preservation**: Existing leads keep their sources/tags when re-uploaded

## Testing Status

- ✅ **Local Environment**: Tested and working
- ⚠️ **Vercel Production**: Not yet tested (user confirmed)

## Recommendations

1. Test in Vercel production environment
2. Monitor for any unique constraint violations
3. Check logs for any unexpected conflicts
4. Verify data integrity after multiple uploads of the same file
