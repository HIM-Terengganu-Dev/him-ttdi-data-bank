const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = 'C:\\Users\\amiey\\Desktop\\Camis\\Work\\HIM Wellness TTDI\\data-bank-dashboard\\data-files\\leads\\device_5850_lead_id_299341.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // Dump A1:H10 (first 10 rows, 8 columns)
    const range = { s: { c: 0, r: 0 }, e: { c: 7, r: 9 } };

    console.log('Grid Dump (Rows 0-9, Cols A-H):');

    for (let R = range.s.r; R <= range.e.r; ++R) {
        let rowStr = `Row ${R}: `;
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell_address = { c: C, r: R };
            const cell_ref = XLSX.utils.encode_cell(cell_address);
            const cell = sheet[cell_ref];

            const val = cell ? JSON.stringify(cell.v) : 'NULL';
            rowStr += `[${cell_ref}: ${val}]\t`;
        }
        console.log(rowStr);
    }

} catch (error) {
    console.error('Error:', error);
}
