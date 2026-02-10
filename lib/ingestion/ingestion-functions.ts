/**
 * Ingestion functions for different CSV file types
 * These functions accept records (parsed CSV rows) instead of file paths
 */

import { Pool } from 'pg';
import {
  normalizePhoneNumber,
  cleanIdNo,
  parseDate,
  parseTime,
  parseDecimal,
  findOrCreatePatient,
  findOrCreateDoctor,
  extractDoctorCode,
} from './ingestion-helpers';

export interface IngestionResult {
  inserted: number;
  updated: number;
  failed: number;
  skipped?: number; // Rows skipped (e.g., OTC, empty fields)
}

// Ingest Patient Details
export async function ingestPatientDetails(
  pool: Pool,
  records: any[]
): Promise<IngestionResult> {
  let inserted = 0;
  let updated = 0;
  let failed = 0;
  let skipped = 0;
  
  for (const row of records) {
    try {
      const phoneNo = normalizePhoneNumber(row['PHONE NO'] || '');
      if (!phoneNo) {
        failed++;
        continue;
      }
      
      const existing = await pool.query(
        'SELECT patient_id FROM him_ttdi.patients WHERE phone_no = $1',
        [phoneNo]
      );
      
      const patientData = {
        phone_no: phoneNo,
        name: row['NAME'] || null,
        mrn_no: row['MRN NO'] || null,
        id_no: cleanIdNo(row['ID NO']),
        id_type: row['ID TYPE'] || null,
        date_of_birth: parseDate(row['DATE OF BIRTH'] || ''),
        // age is automatically calculated by database trigger from date_of_birth
        // DO NOT include age in INSERT/UPDATE - it will conflict with the trigger
        gender: row['GENDER'] || null,
        nationality: row['NATIONALITY'] || null,
        race: row['RACE'] || null,
        ethnicity: row['ETHNICITY'] || null,
        marital_status: row['MARITAL STATUS'] || null,
        address: row['ADDRESS'] || null,
        email: row['EMAIL'] || null,
        visit_total: row['VISIT TOTAL'] ? parseInt(row['VISIT TOTAL']) : 0,
        first_visit_date: parseDate(row['FIRST VISIT DATE'] || ''),
      };
      
      if (existing.rows.length > 0) {
        await pool.query(
          `UPDATE him_ttdi.patients SET
            name = COALESCE($1, name),
            mrn_no = COALESCE($2, mrn_no),
            id_no = COALESCE($3, id_no),
            id_type = COALESCE($4, id_type),
            date_of_birth = COALESCE($5, date_of_birth),
            gender = COALESCE($6, gender),
            nationality = COALESCE($7, nationality),
            race = COALESCE($8, race),
            ethnicity = COALESCE($9, ethnicity),
            marital_status = COALESCE($10, marital_status),
            address = COALESCE($11, address),
            email = COALESCE($12, email),
            visit_total = COALESCE($13, visit_total),
            first_visit_date = COALESCE($14, first_visit_date)
          WHERE patient_id = $15`,
          [
            patientData.name, patientData.mrn_no, patientData.id_no,
            patientData.id_type, patientData.date_of_birth,
            patientData.gender, patientData.nationality, patientData.race,
            patientData.ethnicity, patientData.marital_status, patientData.address,
            patientData.email, patientData.visit_total, patientData.first_visit_date,
            existing.rows[0].patient_id
          ]
        );
        updated++;
      } else {
        await pool.query(
          `INSERT INTO him_ttdi.patients 
           (phone_no, name, mrn_no, id_no, id_type, date_of_birth, gender, nationality, 
            race, ethnicity, marital_status, address, email, visit_total, first_visit_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            patientData.phone_no, patientData.name, patientData.mrn_no, patientData.id_no,
            patientData.id_type, patientData.date_of_birth,
            patientData.gender, patientData.nationality, patientData.race,
            patientData.ethnicity, patientData.marital_status, patientData.address,
            patientData.email, patientData.visit_total, patientData.first_visit_date
          ]
        );
        inserted++;
      }
    } catch (error: any) {
      console.error(`Error processing patient: ${error.message}`);
      failed++;
    }
  }
  
  return { inserted, updated, failed, skipped };
}

// Ingest Consultations
export async function ingestConsultations(
  pool: Pool,
  records: any[]
): Promise<IngestionResult> {
  let inserted = 0;
  let updated = 0;
  let failed = 0;
  let skipped = 0;
  
  for (const row of records) {
    try {
      const icNo = row['PATIENT\'S ICNO'] || row['PATIENT\'S ICNO'] || '';
      const phoneNo = normalizePhoneNumber(icNo.replace(/^="|"$/g, ''));
      
      if (!phoneNo) {
        failed++;
        continue;
      }
      
      const patientName = row['PATIENT\'S NAME'] || row['PATIENT NAME'] || null;
      const mrnNo = row['PATIENT\'S MRN NO'] || row['MRN NO'] || null;
      const patientId = await findOrCreatePatient(pool, phoneNo, patientName, mrnNo, icNo);
      
      const doctorInfo = extractDoctorCode(row['DOCTOR\'S NAME'] || '');
      const doctorId = await findOrCreateDoctor(pool, doctorInfo.name, doctorInfo.code || undefined);
      
      const visitDate = parseDate(row['DATE'] || '');
      if (!visitDate) {
        failed++;
        continue;
      }
      
      const visitTime = parseTime(row['TIME'] || '');
      
      // Check if record exists for counting (but use ON CONFLICT for actual operation)
      const existing = await pool.query(
        `SELECT consultation_id FROM him_ttdi.consultations 
         WHERE patient_id = $1 AND doctor_id = $2 AND visit_date = $3 AND visit_time = $4`,
        [patientId, doctorId, visitDate, visitTime]
      );
      
      // Use ON CONFLICT to handle duplicates and overlapping dates
      await pool.query(
        `INSERT INTO him_ttdi.consultations 
         (patient_id, doctor_id, visit_date, visit_time, start_treatment_date, start_treatment_time,
          end_treatment_date, end_treatment_time, end_pharmacy_date, end_pharmacy_time,
          end_payment_date, end_payment_time, diagnosis, prescription, procedures, disposables,
          imagings, generals, lab_tests, packages, total_payment)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
         ON CONFLICT (patient_id, doctor_id, visit_date, visit_time) DO UPDATE SET
           start_treatment_date = COALESCE(EXCLUDED.start_treatment_date, consultations.start_treatment_date),
           start_treatment_time = COALESCE(EXCLUDED.start_treatment_time, consultations.start_treatment_time),
           end_treatment_date = COALESCE(EXCLUDED.end_treatment_date, consultations.end_treatment_date),
           end_treatment_time = COALESCE(EXCLUDED.end_treatment_time, consultations.end_treatment_time),
           end_pharmacy_date = COALESCE(EXCLUDED.end_pharmacy_date, consultations.end_pharmacy_date),
           end_pharmacy_time = COALESCE(EXCLUDED.end_pharmacy_time, consultations.end_pharmacy_time),
           end_payment_date = COALESCE(EXCLUDED.end_payment_date, consultations.end_payment_date),
           end_payment_time = COALESCE(EXCLUDED.end_payment_time, consultations.end_payment_time),
           diagnosis = COALESCE(EXCLUDED.diagnosis, consultations.diagnosis),
           prescription = COALESCE(EXCLUDED.prescription, consultations.prescription),
           procedures = COALESCE(EXCLUDED.procedures, consultations.procedures),
           disposables = COALESCE(EXCLUDED.disposables, consultations.disposables),
           imagings = COALESCE(EXCLUDED.imagings, consultations.imagings),
           generals = COALESCE(EXCLUDED.generals, consultations.generals),
           lab_tests = COALESCE(EXCLUDED.lab_tests, consultations.lab_tests),
           packages = COALESCE(EXCLUDED.packages, consultations.packages),
           total_payment = COALESCE(EXCLUDED.total_payment, consultations.total_payment)`,
        [
          patientId, doctorId, visitDate, visitTime,
          parseDate(row['START TREATMENT DATE'] || ''),
          parseTime(row['START TREATMENT TIME'] || ''),
          parseDate(row['END TREATMENT DATE'] || ''),
          parseTime(row['END TREATMENT TIME'] || ''),
          parseDate(row['END PHARMACY DATE'] || ''),
          parseTime(row['END PHARMACY TIME'] || ''),
          parseDate(row['END PAYMENT DATE'] || ''),
          parseTime(row['END PAYMENT TIME'] || ''),
          row['DIAGNOSIS'] || null,
          row['PRESCRIPTION'] || null,
          row['PROCEDURES'] || null,
          row['DISPOSABLES'] || null,
          row['IMAGINGS'] || null,
          row['GENERALS'] || null,
          row['LABTESTS'] || null,
          row['PACKAGES'] || null,
          parseDecimal(row['TOTAL PAYMENT'] || 0)
        ]
      );
      
      // Count based on whether record existed before
      if (existing.rows.length > 0) {
        updated++;
      } else {
        inserted++;
      }
    } catch (error: any) {
      console.error(`Error processing consultation: ${error.message}`);
      failed++;
    }
  }
  
  return { inserted, updated, failed, skipped };
}

// Ingest Procedure Prescriptions
export async function ingestProcedurePrescriptions(
  pool: Pool,
  records: any[]
): Promise<IngestionResult> {
  let inserted = 0;
  let updated = 0;
  let failed = 0;
  let skipped = 0;
  
  for (const row of records) {
    try {
      if (!row['PROCEDURE'] || !row['DATE']) {
        skipped++;
        continue;
      }
      
      const icNo = cleanIdNo(row['IC/PASSPORT']) || '';
      const mrnNo = row['MRN NO'] || null;
      
      let patientId: number | null = null;
      
      if (mrnNo) {
        const patientResult = await pool.query(
          'SELECT patient_id FROM him_ttdi.patients WHERE mrn_no = $1',
          [mrnNo.toString()]
        );
        if (patientResult.rows.length > 0) {
          patientId = patientResult.rows[0].patient_id;
        }
      }
      
      if (!patientId && icNo && icNo.length >= 8) {
        const phoneNo = normalizePhoneNumber(icNo);
        patientId = await findOrCreatePatient(pool, phoneNo, row['NAME'] || null, mrnNo, icNo);
      }
      
      if (!patientId) {
        failed++;
        continue;
      }
      
      const doctorName = row['PRESCRIBING DOCTOR'] || '';
      if (!doctorName || doctorName === 'OTC') {
        skipped++;
        continue;
      }
      
      const doctorInfo = extractDoctorCode(doctorName);
      const doctorId = await findOrCreateDoctor(pool, doctorInfo.name, doctorInfo.code || undefined);
      
      const prescriptionDate = parseDate(row['DATE'] || '');
      if (!prescriptionDate) {
        failed++;
        continue;
      }
      
      const procedureCode = row['CODE'] || '';
      const existing = await pool.query(
        `SELECT prescription_id FROM him_ttdi.procedure_prescriptions 
         WHERE patient_id = $1 AND prescribing_doctor_id = $2 AND prescription_date = $3 AND procedure_code = $4`,
        [patientId, doctorId, prescriptionDate, procedureCode]
      );
      
      await pool.query(
        `INSERT INTO him_ttdi.procedure_prescriptions 
         (patient_id, prescribing_doctor_id, dispensing_staff, prescription_date, diagnosis, procedure_name, procedure_code, quantity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (patient_id, prescribing_doctor_id, prescription_date, procedure_code) DO UPDATE SET
           dispensing_staff = COALESCE(EXCLUDED.dispensing_staff, procedure_prescriptions.dispensing_staff),
           diagnosis = COALESCE(EXCLUDED.diagnosis, procedure_prescriptions.diagnosis),
           procedure_name = COALESCE(EXCLUDED.procedure_name, procedure_prescriptions.procedure_name),
           quantity = COALESCE(EXCLUDED.quantity, procedure_prescriptions.quantity)`,
        [
          patientId,
          doctorId,
          row['DISPENSING STAFF'] || null,
          prescriptionDate,
          row['DIAGNOSIS'] || null,
          row['PROCEDURE'] || null,
          procedureCode,
          row['QUANTITY'] || null,
        ]
      );
      
      if (existing.rows.length > 0) {
        updated++;
      } else {
        inserted++;
      }
    } catch (error: any) {
      console.error(`Error processing procedure prescription: ${error.message}`);
      failed++;
    }
  }
  
  return { inserted, updated, failed, skipped };
}

// Ingest Medicine Prescriptions
export async function ingestMedicinePrescriptions(
  pool: Pool,
  records: any[]
): Promise<IngestionResult> {
  let inserted = 0;
  let updated = 0;
  let failed = 0;
  let skipped = 0;
  
  for (const row of records) {
    try {
      if (!row['MEDICINE'] || !row['DATE']) {
        skipped++;
        continue;
      }
      
      const icNo = cleanIdNo(row['IC/PASSPORT']) || '';
      const mrnNo = row['MRN NO'] || null;
      
      let patientId: number | null = null;
      
      if (mrnNo) {
        const patientResult = await pool.query(
          'SELECT patient_id FROM him_ttdi.patients WHERE mrn_no = $1',
          [mrnNo.toString()]
        );
        if (patientResult.rows.length > 0) {
          patientId = patientResult.rows[0].patient_id;
        }
      }
      
      if (!patientId && icNo && icNo.length >= 8) {
        const phoneNo = normalizePhoneNumber(icNo);
        patientId = await findOrCreatePatient(pool, phoneNo, row['NAME'] || null, mrnNo, icNo);
      }
      
      if (!patientId) {
        failed++;
        continue;
      }
      
      const doctorName = row['PRESCRIBING DOCTOR'] || '';
      if (!doctorName || doctorName === 'OTC') {
        skipped++;
        continue;
      }
      
      const doctorInfo = extractDoctorCode(doctorName);
      const doctorId = await findOrCreateDoctor(pool, doctorInfo.name, doctorInfo.code || undefined);
      
      const prescriptionDate = parseDate(row['DATE'] || '');
      if (!prescriptionDate) {
        failed++;
        continue;
      }
      
      const medicineCode = row['CODE'] || '';
      const existing = await pool.query(
        `SELECT prescription_id FROM him_ttdi.medicine_prescriptions 
         WHERE patient_id = $1 AND prescribing_doctor_id = $2 AND prescription_date = $3 AND medicine_code = $4`,
        [patientId, doctorId, prescriptionDate, medicineCode]
      );
      
      await pool.query(
        `INSERT INTO him_ttdi.medicine_prescriptions 
         (patient_id, prescribing_doctor_id, dispensing_staff, prescription_date, diagnosis, medicine_name, medicine_code, quantity)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (patient_id, prescribing_doctor_id, prescription_date, medicine_code) DO UPDATE SET
           dispensing_staff = COALESCE(EXCLUDED.dispensing_staff, medicine_prescriptions.dispensing_staff),
           diagnosis = COALESCE(EXCLUDED.diagnosis, medicine_prescriptions.diagnosis),
           medicine_name = COALESCE(EXCLUDED.medicine_name, medicine_prescriptions.medicine_name),
           quantity = COALESCE(EXCLUDED.quantity, medicine_prescriptions.quantity)`,
        [
          patientId,
          doctorId,
          row['DISPENSING STAFF'] || null,
          prescriptionDate,
          row['DIAGNOSIS'] || null,
          row['MEDICINE'] || null,
          medicineCode,
          row['QUANTITY'] || null,
        ]
      );
      
      if (existing.rows.length > 0) {
        updated++;
      } else {
        inserted++;
      }
    } catch (error: any) {
      console.error(`Error processing medicine prescription: ${error.message}`);
      failed++;
    }
  }
  
  return { inserted, updated, failed, skipped };
}

// Ingest Invoices
export async function ingestInvoices(
  pool: Pool,
  records: any[]
): Promise<IngestionResult> {
  let inserted = 0;
  let updated = 0;
  let failed = 0;
  let skipped = 0;
  
  for (const row of records) {
    try {
      const phoneNoRaw = (row['PATIENT PHONE NO'] || '').toString();
      const phoneNo = normalizePhoneNumber(phoneNoRaw.replace(/^="|"$/g, ''));
      const invoiceCode = row['INVOICE/RECEIPT CODE'] || '';
      
      if (!invoiceCode) {
        failed++;
        continue;
      }
      
      let patientId = null;
      if (phoneNo && phoneNo.length >= 8) {
        patientId = await findOrCreatePatient(pool, phoneNo);
      }
      
      const doctorName = row['DOCTOR'] || '';
      let doctorId = null;
      if (doctorName && doctorName !== '') {
        const doctorInfo = extractDoctorCode(doctorName);
        doctorId = await findOrCreateDoctor(pool, doctorInfo.name, doctorInfo.code || undefined);
      }
      
      const invoiceDate = parseDate(row['INVOICE DATE'] || '');
      if (!invoiceDate) {
        failed++;
        continue;
      }
      
      const existing = await pool.query(
        'SELECT invoice_id FROM him_ttdi.invoices WHERE invoice_code = $1',
        [invoiceCode]
      );
      
      await pool.query(
        `INSERT INTO him_ttdi.invoices 
         (patient_id, doctor_id, invoice_date, invoice_code, receipt_code, ref_no, invoice_total, 
          payment_method, tpa_panel_name, employee_policy_details, remark)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (invoice_code) DO UPDATE SET
           patient_id = COALESCE(EXCLUDED.patient_id, invoices.patient_id),
           doctor_id = COALESCE(EXCLUDED.doctor_id, invoices.doctor_id),
           invoice_date = EXCLUDED.invoice_date,
           receipt_code = COALESCE(EXCLUDED.receipt_code, invoices.receipt_code),
           ref_no = COALESCE(EXCLUDED.ref_no, invoices.ref_no),
           invoice_total = EXCLUDED.invoice_total,
           payment_method = COALESCE(EXCLUDED.payment_method, invoices.payment_method),
           tpa_panel_name = COALESCE(EXCLUDED.tpa_panel_name, invoices.tpa_panel_name),
           employee_policy_details = COALESCE(EXCLUDED.employee_policy_details, invoices.employee_policy_details),
           remark = COALESCE(EXCLUDED.remark, invoices.remark)`,
        [
          patientId, doctorId, invoiceDate, invoiceCode,
          row['INVOICE/RECEIPT CODE'] || null,
          row['REF NO'] || null,
          parseDecimal(row['INVOICE/RECEIPT TOTAL'] || 0),
          row['PAYMENT METHOD'] || null,
          row['TPA/PANEL NAME'] || null,
          row['EMPLOYEE/POLICY DETAILS'] || null,
          row['REMARK'] || null
        ]
      );
      
      if (existing.rows.length > 0) {
        updated++;
      } else {
        inserted++;
      }
    } catch (error: any) {
      console.error(`Error processing invoice: ${error.message}`);
      failed++;
    }
  }
  
  return { inserted, updated, failed, skipped };
}

// Ingest Itemized Sales
export async function ingestItemizedSales(
  pool: Pool,
  records: any[]
): Promise<IngestionResult> {
  let inserted = 0;
  let updated = 0;
  let failed = 0;
  let skipped = 0;
  
  for (const row of records) {
    try {
      const invoiceCode = row['INCOIVE CODE'] || row['INVOICE CODE'] || '';
      const visitDate = parseDate(row['VIST DATE'] || row['VISIT DATE'] || '');
      const doctorName = row['DOCTOR'] || '';
      
      if (!invoiceCode || !visitDate || !doctorName) {
        failed++;
        continue;
      }
      
      const invoiceResult = await pool.query(
        'SELECT patient_id FROM him_ttdi.invoices WHERE invoice_code = $1',
        [invoiceCode]
      );
      const patientId = invoiceResult.rows.length > 0 ? invoiceResult.rows[0].patient_id : null;
      
      const doctorInfo = extractDoctorCode(doctorName);
      const doctorId = await findOrCreateDoctor(pool, doctorInfo.name, doctorInfo.code || undefined);
      
      const existing = await pool.query(
        'SELECT sale_id FROM him_ttdi.itemized_sales WHERE invoice_code = $1',
        [invoiceCode]
      );
      
      await pool.query(
        `INSERT INTO him_ttdi.itemized_sales 
         (patient_id, doctor_id, visit_date, visit_time, invoice_code, receipt_code,
          consultation_amount, medicine_amount, procedure_amount, dispensing_amount,
          lab_amount, imaging_amount, general_amount, package_amount, discount_amount,
          tax_amount, total_amount, payment_status, paid_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
         ON CONFLICT (invoice_code) DO UPDATE SET
           patient_id = COALESCE(EXCLUDED.patient_id, itemized_sales.patient_id),
           doctor_id = EXCLUDED.doctor_id,
           visit_date = EXCLUDED.visit_date,
           visit_time = COALESCE(EXCLUDED.visit_time, itemized_sales.visit_time),
           receipt_code = COALESCE(EXCLUDED.receipt_code, itemized_sales.receipt_code),
           consultation_amount = EXCLUDED.consultation_amount,
           medicine_amount = EXCLUDED.medicine_amount,
           procedure_amount = EXCLUDED.procedure_amount,
           dispensing_amount = EXCLUDED.dispensing_amount,
           lab_amount = EXCLUDED.lab_amount,
           imaging_amount = EXCLUDED.imaging_amount,
           general_amount = EXCLUDED.general_amount,
           package_amount = EXCLUDED.package_amount,
           discount_amount = EXCLUDED.discount_amount,
           tax_amount = EXCLUDED.tax_amount,
           total_amount = EXCLUDED.total_amount,
           payment_status = COALESCE(EXCLUDED.payment_status, itemized_sales.payment_status),
           paid_at = COALESCE(EXCLUDED.paid_at, itemized_sales.paid_at)`,
        [
          patientId, doctorId, visitDate, parseTime(row['VISIT TIME'] || ''),
          invoiceCode, row['RECEIPT CODE'] || null,
          parseDecimal(row['CONS'] || 0),
          parseDecimal(row['MED'] || 0),
          parseDecimal(row['PROC'] || 0),
          parseDecimal(row['DISP'] || 0),
          parseDecimal(row['LAB'] || 0),
          parseDecimal(row['IMG'] || 0),
          parseDecimal(row['GEN'] || 0),
          parseDecimal(row['PACKAGE'] || 0),
          parseDecimal(row['DISCOUNT'] || 0),
          parseDecimal(row['TAX'] || 0),
          parseDecimal(row['TOTAL'] || 0),
          row['PAYMENT STATUS'] || null,
          parseDate(row['PAID AT'] || '')
        ]
      );
      
      if (existing.rows.length > 0) {
        updated++;
      } else {
        inserted++;
      }
    } catch (error: any) {
      console.error(`Error processing itemized sale: ${error.message}`);
      failed++;
    }
  }
  
  return { inserted, updated, failed, skipped };
}

// Ingest Daily Doctor Sales
export async function ingestDailyDoctorSales(
  pool: Pool,
  records: any[]
): Promise<IngestionResult> {
  let inserted = 0;
  let updated = 0;
  let failed = 0;
  let skipped = 0;
  
  const doctorColumns: { name: string; visitCol: string; salesCol: string }[] = [];
  const headers = Object.keys((records[0] as Record<string, any>) || {});
  
  for (const header of headers) {
    if (header.includes('VISIT NO')) {
      const doctorName = header.replace(' (VISIT NO)', '').trim();
      const salesCol = header.replace('VISIT NO', 'TOTAL SALES');
      doctorColumns.push({
        name: doctorName,
        visitCol: header,
        salesCol: salesCol,
      });
    }
  }
  
  for (const row of records) {
    try {
      const saleDate = parseDate(row['DATE'] || '');
      if (!saleDate || row['DATE'] === 'TOTAL') {
        skipped++;
        continue;
      }
      
      for (const doctorCol of doctorColumns) {
        const visitCount = parseInt(row[doctorCol.visitCol] || '0');
        const totalSales = parseDecimal(row[doctorCol.salesCol] || '0');
        
        if (visitCount > 0 || totalSales > 0) {
          const doctorInfo = extractDoctorCode(doctorCol.name);
          const doctorId = await findOrCreateDoctor(pool, doctorInfo.name, doctorInfo.code || undefined);
          
          // Check if record exists for counting (but use ON CONFLICT for actual operation)
          const existing = await pool.query(
            `SELECT daily_sale_id FROM him_ttdi.daily_doctor_sales 
             WHERE sale_date = $1 AND doctor_id = $2`,
            [saleDate, doctorId]
          );
          
          await pool.query(
            `INSERT INTO him_ttdi.daily_doctor_sales (sale_date, doctor_id, visit_count, total_sales)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (sale_date, doctor_id) DO UPDATE SET
               visit_count = EXCLUDED.visit_count,
               total_sales = EXCLUDED.total_sales`,
            [saleDate, doctorId, visitCount, totalSales]
          );
          
          // Count based on whether record existed before
          if (existing.rows.length > 0) {
            updated++;
          } else {
            inserted++;
          }
        }
      }
    } catch (error: any) {
      console.error(`Error processing daily sales: ${error.message}`);
      failed++;
    }
  }
  
  return { inserted, updated, failed, skipped };
}
