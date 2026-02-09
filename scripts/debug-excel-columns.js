const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = 'C:\\Users\\amiey\\Desktop\\Camis\\Work\\HIM Wellness TTDI\\data-bank-dashboard\\data-files\\leads\\device_5850_lead_id_299341.xlsx';

try {
    const buffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Get raw data as array of arrays
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    console.log(`Total Rows: ${rows.length}`);

    // Find first 3 non-empty rows
    let count = 0;
    rows.forEach((row, index) => {
        if (count >= 3) return;
        // Check if row has any content
        if (row.some(cell => cell !== '')) {
            console.log(`\n--- Row ${index + 1} ---`);
            console.log(JSON.stringify(row, null, 2));
            count++;
        }
    });

} catch (error) {
    console.error('Error:', error.message);
}
