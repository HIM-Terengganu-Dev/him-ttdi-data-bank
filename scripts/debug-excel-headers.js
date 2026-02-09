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
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Read first 20 rows
    const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        range: 0,
        defval: null, // use null for empty cells so we see them
    }).slice(0, 20);

    console.log('First 20 rows of the Excel file:');
    rows.forEach((row, index) => {
        // Print row with index
        console.log(`Row ${index}:`, JSON.stringify(row));
    });

} catch (error) {
    console.error('Error reading Excel file:', error);
}
