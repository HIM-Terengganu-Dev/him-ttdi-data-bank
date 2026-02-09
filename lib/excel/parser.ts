/**
 * Excel file parser utility
 * Parses .xlsx files and converts them to records format similar to CSV parsing
 */

import * as XLSX from 'xlsx';

export interface ExcelParseResult {
  records: any[];
  headers: string[];
}

/**
 * Parse Excel file buffer and return records
 */
export function parseExcelFile(buffer: Buffer): ExcelParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  // Get the first sheet
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert to JSON with header row
  const jsonData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1, // Use array format first
    defval: '', // Default value for empty cells
    raw: false, // Convert all values to strings
  });

  if (jsonData.length === 0) {
    return { records: [], headers: [] };
  }

  // First row is headers
  const headers = (jsonData[0] as any[]).map((h: any) => String(h || '').trim());

  // Convert remaining rows to objects
  const records = (jsonData.slice(1) as any[][]).map((row: any[]) => {
    const record: any = {};
    headers.forEach((header, index) => {
      const value = row[index];
      record[header] = value !== undefined && value !== null ? String(value).trim() : '';
    });
    return record;
  }).filter((record) => {
    // Filter out completely empty rows
    return Object.values(record).some((val) => val !== '');
  });

  return { records, headers };
}

/**
 * Read Excel file headers only (for file type detection)
 */
export function readExcelHeaders(buffer: Buffer): string[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Read only first row
  const firstRow = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    range: 1, // Only first row
    defval: '',
    raw: false,
  });

  if (firstRow.length === 0) {
    return [];
  }

  return (firstRow[0] as any[]).map((h: any) => String(h || '').trim());
}

/**
 * Parse Excel file buffer and return raw records (array of arrays)
 * Useful for files without headers
 */
export function parseExcelFileRaw(buffer: Buffer): any[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  // Get the first sheet
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert to JSON with array of arrays (header: 1)
  const jsonData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1, // Use array format
    defval: '', // Default value for empty cells
    raw: false, // Convert all values to strings
    blankrows: false // Skip blank rows
  });

  return jsonData;
}
