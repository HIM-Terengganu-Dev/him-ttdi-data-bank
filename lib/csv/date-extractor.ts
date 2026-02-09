/**
 * Extract date from CSV data for reporting
 */

export function extractDateFromCSVData(fileType: string, csvData: any[]): Date | null {
  if (!csvData || csvData.length === 0) return null;

  const firstRow = csvData[0];

  switch (fileType) {
    case 'patient_details':
      // Look for FIRST VISIT DATE
      const firstVisitDate = firstRow['FIRST VISIT DATE'] || firstRow['first_visit_date'];
      if (firstVisitDate) {
        return parseDate(firstVisitDate);
      }
      break;

    case 'consultation':
      // Look for DATE column
      const consultDate = firstRow['DATE'] || firstRow['date'];
      if (consultDate) {
        return parseDate(consultDate);
      }
      break;

    case 'procedure_prescription':
    case 'medicine_prescription':
      // Look for DATE column
      const prescDate = firstRow['DATE'] || firstRow['date'];
      if (prescDate) {
        return parseDate(prescDate);
      }
      break;

    case 'itemized_sales':
      // Look for VIST DATE or VISIT DATE
      const visitDate = firstRow['VIST DATE'] || firstRow['VISIT DATE'] || firstRow['visit_date'];
      if (visitDate) {
        return parseDate(visitDate);
      }
      break;

    case 'invoice':
      // Look for INVOICE DATE
      const invoiceDate = firstRow['INVOICE DATE'] || firstRow['invoice_date'];
      if (invoiceDate) {
        return parseDate(invoiceDate);
      }
      break;

    case 'daily_doctor_sales':
      // Look for DATE column
      const salesDate = firstRow['DATE'] || firstRow['date'];
      if (salesDate) {
        return parseDate(salesDate);
      }
      break;
  }

  return null;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Handle DD/MM/YYYY format
  const ddmmyyyy = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (ddmmyyyy) {
    return new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`);
  }

  // Handle DD/MM/YYYY HH:MM:SS format
  const ddmmyyyyhhmmss = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (ddmmyyyyhhmmss) {
    const year = ddmmyyyyhhmmss[3];
    const month = ddmmyyyyhhmmss[2];
    const day = ddmmyyyyhhmmss[1];
    const dateStrISO = `${year}-${month}-${day}T${ddmmyyyyhhmmss[4]}:${ddmmyyyyhhmmss[5]}:${ddmmyyyyhhmmss[6]}+08:00`;
    return new Date(dateStrISO);
  }

  const iso = new Date(dateStr);
  if (!isNaN(iso.getTime())) {
    return iso;
  }

  return null;
}
