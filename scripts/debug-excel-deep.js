const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = 'C:\\Users\\amiey\\Desktop\\Camis\\Work\\HIM Wellness TTDI\\data-bank-dashboard\\data-files\\leads\\device_5850_lead_id_299341.xlsx';

try {
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    const workbook = XLSX.readFile(filePath);
    console.log('Sheets found:', workbook.SheetNames);

    workbook.SheetNames.forEach(sheetName => {
        console.log(`\n--- Inspecting Sheet: ${sheetName} ---`);
        const worksheet = workbook.Sheets[sheetName];

        // Get range
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
        console.log(`Range: ${range.s.r}:${range.s.c} to ${range.e.r}:${range.e.c}`);

        // Convert to JSON (array of arrays)
        const rows = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            range: 0,
            defval: null
        });

        console.log(`Total rows read: ${rows.length}`);

        // Look for potential headers
        const keywords = ['ID', 'DATE', 'PHONE', 'NAME', 'LEAD', 'STATUS', 'SOURCE'];

        let headerRowIndex = -1;

        for (let i = 0; i < Math.min(rows.length, 50); i++) {
            const row = rows[i];
            const rowStr = JSON.stringify(row).toUpperCase();
            console.log(`Row ${i}:`, JSON.stringify(row));

            // Check if this row contains multiple keywords
            const matchCount = keywords.filter(k => rowStr.includes(k)).length;
            if (matchCount >= 2) {
                console.log(`POTENTIAL HEADER FOUND AT ROW ${i}`);
                headerRowIndex = i;
            }
        }
    });

} catch (error) {
    console.error('Error reading Excel file:', error);
}
