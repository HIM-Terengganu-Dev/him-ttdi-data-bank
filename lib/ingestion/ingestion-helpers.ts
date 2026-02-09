/**
 * Shared ingestion helper functions
 * Used by both CLI scripts and web API
 */

import { Pool } from 'pg';

// Helper functions
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';
  let normalized = phone.toString().replace(/[\s\-\(\)]/g, '');
  normalized = normalized.replace(/^=/, '');
  normalized = normalized.replace(/"/g, '');
  return normalized.trim();
}

export function cleanIdNo(idNo: string | null | undefined): string | null {
  if (!idNo) return null;
  return idNo.toString()
    .replace(/^="/, '')  // Remove leading ="
    .replace(/"$/, '')  // Remove trailing "
    .trim() || null;
}

export function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Handle DD/MM/YYYY HH:MM:SS format FIRST (more specific)
  // CSV times are in Malaysia timezone (UTC+8)
  const ddmmyyyyhhmmss = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
  if (ddmmyyyyhhmmss) {
    const year = ddmmyyyyhhmmss[3];
    const month = ddmmyyyyhhmmss[2];
    const day = ddmmyyyyhhmmss[1];
    const hour = ddmmyyyyhhmmss[4].padStart(2, '0');
    const minute = ddmmyyyyhhmmss[5];
    const second = ddmmyyyyhhmmss[6];
    const dateStrISO = `${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`;
    const date = new Date(dateStrISO);
    return date;
  }
  
  // Handle DD/MM/YYYY format (date only)
  const ddmmyyyy = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (ddmmyyyy) {
    return new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`);
  }
  
  const iso = new Date(dateStr);
  if (!isNaN(iso.getTime())) {
    return iso;
  }
  
  return null;
}

export function parseTime(timeStr: string): string | null {
  if (!timeStr) return null;
  
  const hhmm = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (hhmm) {
    return `${hhmm[1].padStart(2, '0')}:${hhmm[2]}:00`;
  }
  
  const ampm = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (ampm) {
    let hours = parseInt(ampm[1]);
    const minutes = ampm[2];
    const period = ampm[3].toUpperCase();
    
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    return `${hours.toString().padStart(2, '0')}:${minutes}:00`;
  }
  
  return null;
}

export function parseDecimal(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const cleaned = value.toString().replace(/,/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export async function findOrCreatePatient(
  pool: Pool,
  phoneNo: string,
  name?: string,
  mrnNo?: string,
  idNo?: string
): Promise<number> {
  const result = await pool.query(
    `SELECT him_ttdi.find_or_create_patient($1, $2, $3, $4) as patient_id`,
    [phoneNo, name || null, mrnNo || null, idNo || null]
  );
  return result.rows[0].patient_id;
}

export async function findOrCreateDoctor(
  pool: Pool,
  doctorName: string,
  doctorCode?: string
): Promise<number> {
  const result = await pool.query(
    `SELECT him_ttdi.find_or_create_doctor($1, $2) as doctor_id`,
    [doctorName, doctorCode || null]
  );
  return result.rows[0].doctor_id;
}

export function extractDoctorCode(doctorName: string): { name: string; code: string | null } {
  const match = doctorName.match(/^(.+?)\s*\((\d+)\)$/);
  let name: string;
  let code: string | null = null;
  
  if (match) {
    name = match[1].trim();
    code = match[2];
  } else {
    name = doctorName.trim();
  }
  
  // Normalize name to prefer "Dr." prefix
  if (!/^Dr\.?\s/i.test(name)) {
    name = `Dr. ${name}`;
  }
  
  return { name, code };
}
