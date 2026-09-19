const XLSX = require('@e965/xlsx');
const fs = require('fs');
const path = require('path');

const headers = [
  'SVP GL', 'MANUFACTURER', 'MANUFACTURER NUMBER', 'ITEM DESCRIPTION',
  'PACK PRICE', 'PACK TYPE', 'PACK UNITS', 'COUNT TYPE', 'COUNT',
  'ITEM PRICE', 'VALUE ON HAND', '', 'LOG #1', 'LOG #2', 'LOG #3', 'LOG #4', 'LOG #5', '',
];
const title = [
  '', 'PLEASE USE THIS VERSION FOR JUNE 2026-SEPTEMBER 2026 INVENTORY COUNTS',
  '', '', '', '', '', '', 'INVENTORY ON HAND, PAGE SUBTOTAL:',
  '', '', '', 'DEA Log for Controlled Substances', '', '', '', '', 'Q3-2026',
];
const letters = ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', '', '!LOG #1 is Required!', '', '', '', '*LOG #2-#5 are Optional', ''];
const rows = [
  title,
  letters,
  headers,
  ['Pharmacy Rx Oral/Topical', 'Example Vet', '00000-0000-01', 'Sample Carprofen 100mg, 60 Count', '', 'tablet', '60', 'EACH', '', '', '', '', '', '', '', '', '', ''],
  ['Pharmacy Injectable', 'Example Vet', '00000-0000-02', 'Sample Alfaxan 10mL', '', 'ml', '10', 'EACH', '', '', '', '', '', '', '', '', '', ''],
  ['Vaccination', 'Example Vet', '00000-0000-03', 'Sample Distemper 25-dose tray', '', 'tray', '25', 'EACH', '', '', '', '', '', '', '', '', '', ''],
  ['!!SELECT GL!!', '', '', '', '', 'NA', 1, 'PACK/BUNDLE', '', '', '', '', '', '', '', '', '', ''],
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.aoa_to_sheet([
    ['Megatory Live Inventory Template - Instructions'],
    [''],
    ['Three tabs match MEGATORY_HOSPITAL CODE 3Q2026 FINAL.xlsx'],
    ['Instructions | INVENTORY SHEET | CATEGORIES'],
  ]),
  'Instructions',
);
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'INVENTORY SHEET');
XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.aoa_to_sheet([
    ['Category', 'Current Count'],
    ['Pharmacy Rx Oral/Topical', ''],
    ['Pharmacy Injectable', ''],
    ['Vaccination', ''],
    ['', ''],
    ['Total', ''],
    ['Check', ''],
  ]),
  'CATEGORIES',
);

const out = path.join(__dirname, '..', 'assets', 'sample-vet-inventory.xlsx');
fs.writeFileSync(out, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
console.log('wrote', out);
