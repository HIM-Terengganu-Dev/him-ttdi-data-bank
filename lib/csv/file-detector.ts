/**
 * CSV File Type Detector
 * Detects which Remedii CSV file type based on CSV content (headers) rather than filename
 */

export type CSVFileType =
  | 'patient_details'
  | 'consultation'
  | 'procedure_prescription'
  | 'medicine_prescription'
  | 'itemized_sales'
  | 'invoice'
  | 'daily_doctor_sales'
  | 'leads_tiktok_beg_biru'
  | 'leads_wsapme'
  | 'leads_device_export'
  | 'unknown';

export interface DetectedFile {
  type: CSVFileType;
  tableName: string;
  displayName: string;
  fileName: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Detect CSV file type based on CSV content (headers)
 * This is the primary detection method - more reliable than filename
 */
export function detectFileTypeByContent(headers: string[]): DetectedFile | null {
  if (!headers || headers.length === 0) {
    return null;
  }

  const headersUpper = headers.map((h) => h.toUpperCase().trim());
  const headersStr = headersUpper.join(' ');

  // 1. Patient Details Report
  // Key indicators: NAME, ID NO, MRN NO, PHONE NO, FIRST VISIT DATE
  if (
    headersUpper.includes('NAME') &&
    (headersUpper.includes('ID NO') || headersUpper.includes('IDNO')) &&
    (headersUpper.includes('MRN NO') || headersUpper.includes('MRNNO')) &&
    (headersUpper.includes('PHONE NO') || headersUpper.includes('PHONENO')) &&
    (headersUpper.includes('FIRST VISIT DATE') || headersUpper.includes('VISIT TOTAL'))
  ) {
    return {
      type: 'patient_details',
      tableName: 'patients',
      displayName: 'Patient Details',
      fileName: '', // Will be set by caller
      confidence: 'high',
    };
  }

  // 2. Consultation Report
  // Key indicators: DOCTOR'S NAME, PATIENT'S NAME, PATIENT'S ICNO, PATIENT'S MRN NO, DIAGNOSIS, TOTAL PAYMENT
  if (
    (headersStr.includes("DOCTOR'S NAME") || headersStr.includes('DOCTOR NAME')) &&
    (headersStr.includes("PATIENT'S NAME") || headersStr.includes('PATIENT NAME')) &&
    (headersStr.includes("PATIENT'S ICNO") || headersStr.includes("PATIENT'S MRN NO")) &&
    headersUpper.includes('DIAGNOSIS') &&
    (headersUpper.includes('TOTAL PAYMENT') || headersUpper.includes('TOTALPAYMENT'))
  ) {
    return {
      type: 'consultation',
      tableName: 'consultations',
      displayName: 'Consultation Report',
      fileName: '',
      confidence: 'high',
    };
  }

  // 3. Procedure Prescription
  // Key indicators: IC/PASSPORT, MRN NO, PRESCRIBING DOCTOR, PROCEDURE, CODE
  if (
    (headersUpper.includes('IC/PASSPORT') || headersUpper.includes('IC PASSPORT')) &&
    (headersUpper.includes('MRN NO') || headersUpper.includes('MRNNO')) &&
    (headersUpper.includes('PRESCRIBING DOCTOR') || headersUpper.includes('PRESCRIBINGDOCTOR')) &&
    headersUpper.includes('PROCEDURE') &&
    headersUpper.includes('CODE')
  ) {
    return {
      type: 'procedure_prescription',
      tableName: 'procedure_prescriptions',
      displayName: 'Procedure Prescriptions',
      fileName: '',
      confidence: 'high',
    };
  }

  // 4. Medicine Prescription
  // Key indicators: IC/PASSPORT, MRN NO, PRESCRIBING DOCTOR, MEDICINE, CODE
  if (
    (headersUpper.includes('IC/PASSPORT') || headersUpper.includes('IC PASSPORT')) &&
    (headersUpper.includes('MRN NO') || headersUpper.includes('MRNNO')) &&
    (headersUpper.includes('PRESCRIBING DOCTOR') || headersUpper.includes('PRESCRIBINGDOCTOR')) &&
    headersUpper.includes('MEDICINE') &&
    headersUpper.includes('CODE')
  ) {
    return {
      type: 'medicine_prescription',
      tableName: 'medicine_prescriptions',
      displayName: 'Medicine Prescriptions',
      fileName: '',
      confidence: 'high',
    };
  }

  // 5. Itemized Sales
  // Key indicators: VIST DATE (or VISIT DATE), INCOIVE CODE (or INVOICE CODE), RECEIPT CODE, DOCTOR, CONS, MED, PROC, TOTAL
  if (
    (headersUpper.includes('VIST DATE') || headersUpper.includes('VISIT DATE')) &&
    (headersUpper.includes('INCOIVE CODE') || headersUpper.includes('INVOICE CODE')) &&
    headersUpper.includes('RECEIPT CODE') &&
    headersUpper.includes('DOCTOR') &&
    (headersUpper.includes('CONS') || headersUpper.includes('MED') || headersUpper.includes('PROC')) &&
    headersUpper.includes('TOTAL')
  ) {
    return {
      type: 'itemized_sales',
      tableName: 'itemized_sales',
      displayName: 'Itemized Sales',
      fileName: '',
      confidence: 'high',
    };
  }

  // 6. Invoice Report
  // Key indicators: INVOICE DATE, PATIENT NAME, PATIENT IC NO, PATIENT PHONE NO, INVOICE/RECEIPT CODE, INVOICE/RECEIPT TOTAL
  if (
    (headersUpper.includes('INVOICE DATE') || headersUpper.includes('INVOICEDATE')) &&
    (headersUpper.includes('PATIENT NAME') || headersUpper.includes('PATIENTNAME')) &&
    (headersUpper.includes('PATIENT IC NO') || headersUpper.includes('PATIENTICNO')) &&
    (headersUpper.includes('PATIENT PHONE NO') || headersUpper.includes('PATIENTPHONENO')) &&
    (headersStr.includes('INVOICE/RECEIPT CODE') || headersStr.includes('INVOICE RECEIPT CODE')) &&
    (headersStr.includes('INVOICE/RECEIPT TOTAL') || headersStr.includes('INVOICE RECEIPT TOTAL'))
  ) {
    return {
      type: 'invoice',
      tableName: 'invoices',
      displayName: 'Invoices',
      fileName: '',
      confidence: 'high',
    };
  }

  // 7. Daily Doctor Sales
  // Key indicators: DATE, multiple columns with "(VISIT NO)" and "(TOTAL SALES)" pattern
  // This has dynamic columns like "DOCTOR NAME (VISIT NO)" and "DOCTOR NAME (TOTAL SALES)"
  const hasVisitNoColumns = headersUpper.some((h) => h.includes('VISIT NO'));
  const hasTotalSalesColumns = headersUpper.some((h) => h.includes('TOTAL SALES'));
  const hasDateColumn = headersUpper.includes('DATE');

  if (hasDateColumn && hasVisitNoColumns && hasTotalSalesColumns) {
    return {
      type: 'daily_doctor_sales',
      tableName: 'daily_doctor_sales',
      displayName: 'Sales Report',
      fileName: '',
      confidence: 'high',
    };
  }

  // 8. Leads - TikTok Beg Biru
  // Key indicators: Lead ID, Username, Received date, Phone number, Name
  if (
    headersUpper.includes('LEAD ID') &&
    headersUpper.includes('USERNAME') &&
    (headersUpper.includes('RECEIVED DATE') || headersUpper.includes('RECEIVEDDATE')) &&
    (headersUpper.includes('PHONE NUMBER') || headersUpper.includes('PHONENUMBER')) &&
    headersUpper.includes('NAME')
  ) {
    return {
      type: 'leads_tiktok_beg_biru',
      tableName: 'leads_tiktok_beg_biru',
      displayName: 'Leads - TikTok Beg Biru',
      fileName: '',
      confidence: 'high',
    };
  }

  // 9. Leads - Wsapme
  // Key indicators: phone and name columns (case insensitive)
  // This is a fallback for files that have phone and name but don't match TikTok format
  const hasPhone = headersUpper.some((h) => h === 'PHONE' || h === 'PHONENUMBER' || h === 'PHONE NUMBER');
  const hasName = headersUpper.some((h) => h === 'NAME');

  // Only detect as Wsapme if it has phone and name but doesn't match TikTok format
  if (hasPhone && hasName && !headersUpper.includes('LEAD ID')) {
    return {
      type: 'leads_wsapme',
      tableName: 'leads_wsapme',
      displayName: 'Leads - Wsapme',
      fileName: '',
      confidence: 'medium',
    };
  }

  return null;
}

/**
 * Detect CSV file type based on filename (fallback method)
 */
export function detectFileTypeByFilename(fileName: string): DetectedFile | null {
  const fileNameUpper = fileName.toUpperCase();

  // Patient Details Report
  if (fileNameUpper.includes('PATIENT DETAILS REPORT')) {
    return {
      type: 'patient_details',
      tableName: 'patients',
      displayName: 'Patient Details',
      fileName,
      confidence: 'medium',
    };
  }

  // Doctor Insights Report - Consultation
  if (fileNameUpper.includes('DOCTOR INSIGHTS REPORT') && fileNameUpper.includes('CONSULTATION')) {
    return {
      type: 'consultation',
      tableName: 'consultations',
      displayName: 'Consultation Report',
      fileName,
      confidence: 'medium',
    };
  }

  // Doctor Insights Report - Sales
  if (fileNameUpper.includes('DOCTOR INSIGHTS REPORT') && fileNameUpper.includes('SALES') && !fileNameUpper.includes('ITEMISE')) {
    return {
      type: 'daily_doctor_sales',
      tableName: 'daily_doctor_sales',
      displayName: 'Sales Report',
      fileName,
      confidence: 'medium',
    };
  }

  // Patient Prescription Report - Procedure
  if (fileNameUpper.includes('PRESCRIPTION REPORT') && fileNameUpper.includes('PROCEDURE')) {
    return {
      type: 'procedure_prescription',
      tableName: 'procedure_prescriptions',
      displayName: 'Procedure Prescriptions',
      fileName,
      confidence: 'medium',
    };
  }

  // Patient Prescription Report - Medicine
  if (fileNameUpper.includes('PRESCRIPTION REPORT') && fileNameUpper.includes('MEDICINE')) {
    return {
      type: 'medicine_prescription',
      tableName: 'medicine_prescriptions',
      displayName: 'Medicine Prescriptions',
      fileName,
      confidence: 'medium',
    };
  }

  // Itemise Sales Report
  if (fileNameUpper.includes('ITEMISE SALES REPORT') || fileNameUpper.includes('ITEMIZED SALES')) {
    return {
      type: 'itemized_sales',
      tableName: 'itemized_sales',
      displayName: 'Itemized Sales',
      fileName,
      confidence: 'medium',
    };
  }

  // Sales Report by Invoice Date
  if (fileNameUpper.includes('SALES') && fileNameUpper.includes('REPORT') && fileNameUpper.includes('INVOICE')) {
    return {
      type: 'invoice',
      tableName: 'invoices',
      displayName: 'Invoices',
      fileName,
      confidence: 'medium',
    };
  }

  // Device Export Leads - treat as Wsapme format (variable headers)
  if (fileNameUpper.startsWith('DEVICE_')) {
    return {
      type: 'leads_wsapme',
      tableName: 'leads',
      displayName: 'Leads - Wsapme (Device Export)',
      fileName,
      confidence: 'medium',
    };
  }

  return null;
}

/**
 * Main detection function - prioritizes content over filename
 */
export function detectFileType(fileName: string, headers?: string[]): DetectedFile {
  // First, try content-based detection (most reliable)
  if (headers && headers.length > 0) {
    const contentDetection = detectFileTypeByContent(headers);
    if (contentDetection) {
      return {
        ...contentDetection,
        fileName,
      };
    }
  }

  // Fallback to filename-based detection
  const filenameDetection = detectFileTypeByFilename(fileName);
  if (filenameDetection) {
    return filenameDetection;
  }

  // Unknown file type
  return {
    type: 'unknown',
    tableName: 'unknown',
    displayName: 'Unknown File Type',
    fileName,
    confidence: 'low',
  };
}

/**
 * Get all valid Remedii file types
 */
export function getRemediiFileTypes(): Array<{ type: CSVFileType; displayName: string; tableName: string }> {
  return [
    { type: 'patient_details', displayName: 'Patient Details', tableName: 'patients' },
    { type: 'consultation', displayName: 'Consultation Report', tableName: 'consultations' },
    { type: 'procedure_prescription', displayName: 'Procedure Prescriptions', tableName: 'procedure_prescriptions' },
    { type: 'medicine_prescription', displayName: 'Medicine Prescriptions', tableName: 'medicine_prescriptions' },
    { type: 'itemized_sales', displayName: 'Itemized Sales', tableName: 'itemized_sales' },
    { type: 'invoice', displayName: 'Invoices', tableName: 'invoices' },
    { type: 'daily_doctor_sales', displayName: 'Sales Report', tableName: 'daily_doctor_sales' },
    { type: 'leads_tiktok_beg_biru', displayName: 'Leads - TikTok Beg Biru', tableName: 'leads_tiktok_beg_biru' },
    { type: 'leads_wsapme', displayName: 'Leads - Wsapme', tableName: 'leads_wsapme' },
    { type: 'leads_device_export', displayName: 'Leads - Device Export', tableName: 'leads_device_export' },
  ];
}
