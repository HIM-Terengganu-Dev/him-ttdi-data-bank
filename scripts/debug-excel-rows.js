const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = 'C:\\Users\\amiey\\Desktop\\Camis\\Work\\HIM Wellness TTDI\\data-bank-dashboard\\data-files\\leads\\device_5850_lead_id_299341.xlsx';

try {
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // Dump rows 3 to 12 (0-indexed)
    for (let r = 3; r <= 12; r++) {
        const cellA = sheet[XLSX.utils.encode_cell({ c: 0, r: r })];
        const cellB = sheet[XLSX.utils.encode_cell({ c: 1, r: r })];
        const cellC = sheet[XLSX.utils.encode_cell({ c: 2, r: r })];

        console.log(`Row ${r}: A=${cellA ? cellA.v : 'NULL'}, B=${cellB ? cellB.v : 'NULL'}, C=${cellC ? cellC.v : 'NULL'}`);
    }

} catch (error) {
    console.error('Error:', error);
}
