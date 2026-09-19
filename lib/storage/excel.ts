import * as XLSX from '@e965/xlsx';
import {
  InventoryItem,
  TEMPLATE_COLUMNS,
  MASTER_SHEET_NAMES,
  WRITE_IN_GL,
  SVP_GL_CATEGORIES,
  itemToTemplateRow,
  templateRowToItem,
} from '../domain/inventory';

const INVENTORY_SHEET = MASTER_SHEET_NAMES.inventory;
const INSTRUCTIONS_SHEET = MASTER_SHEET_NAMES.instructions;
const CATEGORIES_SHEET = MASTER_SHEET_NAMES.categories;

const TITLE = 'PLEASE USE THIS VERSION FOR JUNE 2026-SEPTEMBER 2026 INVENTORY COUNTS';
const WRITE_IN_BLANK_ROWS = 20;

/** Visible columns in the Q3-2026 master, including the blank spacer before the logs. */
const EXPORT_HEADERS = [
  'SVP GL',
  'MANUFACTURER',
  'MANUFACTURER NUMBER',
  'ITEM DESCRIPTION',
  'PACK PRICE',
  'PACK TYPE',
  'PACK UNITS',
  'COUNT TYPE',
  'COUNT',
  'ITEM PRICE',
  'VALUE ON HAND',
  '',
  'LOG #1',
  'LOG #2',
  'LOG #3',
  'LOG #4',
  'LOG #5',
  '',
];

function rowFromItem(item: InventoryItem): (string | number)[] {
  const r = itemToTemplateRow(item);
  return [
    r['SVP GL'],
    r['MANUFACTURER'],
    r['MANUFACTURER NUMBER'],
    r['ITEM DESCRIPTION'],
    r['PACK PRICE'],
    r['PACK TYPE'],
    r['PACK UNITS'],
    r['COUNT TYPE'],
    r['COUNT'],
    r['ITEM PRICE'],
    r['VALUE ON HAND'],
    '',
    r['LOG #1'],
    r['LOG #2'],
    r['LOG #3'],
    r['LOG #4'],
    r['LOG #5'],
    '',
  ];
}

function blankWriteInRow(): (string | number)[] {
  return [WRITE_IN_GL, '', '', '', '', 'NA', 1, 'PACK/BUNDLE', '', '', '', '', '', '', '', '', '', ''];
}

function buildInventorySheet(items: InventoryItem[]): XLSX.WorkSheet {
  const titleRow = [
    '',
    TITLE,
    '', '', '', '', '', '',
    'INVENTORY ON HAND, PAGE SUBTOTAL:',
    '', '', '',
    'DEA Log for Controlled Substances',
    '', '', '', '',
    'Q3-2026',
  ];
  const letterRow = [
    'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
    '',
    '!LOG #1 is Required!',
    '', '', '',
    '*LOG #2-#5 are Optional',
    '',
  ];

  const dataRows = items
    .filter(i => (i.drugName || '').trim() && (i.svpGl || '') !== WRITE_IN_GL)
    .map(rowFromItem);

  const writeIns = items.filter(i => (i.svpGl || '') === WRITE_IN_GL && (i.drugName || '').trim());
  const writeInRows = [
    ...writeIns.map(rowFromItem),
    ...Array.from({ length: Math.max(0, WRITE_IN_BLANK_ROWS - writeIns.length) }, blankWriteInRow),
  ];

  const aoa = [titleRow, letterRow, EXPORT_HEADERS, ...dataRows, ...writeInRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 28 }, // SVP GL
    { wch: 22 }, // MANUFACTURER
    { wch: 22 }, // MANUFACTURER NUMBER
    { wch: 64 }, // ITEM DESCRIPTION
    { wch: 12 }, // PACK PRICE
    { wch: 16 }, // PACK TYPE
    { wch: 12 }, // PACK UNITS
    { wch: 14 }, // COUNT TYPE
    { wch: 10 }, // COUNT
    { wch: 12 }, // ITEM PRICE
    { wch: 16 }, // VALUE ON HAND
    { wch: 3 },  // spacer
    { wch: 12 }, // LOG #1
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 3 },
  ];
  return ws;
}

function buildInstructionsSheet(): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    [TITLE],
    [''],
    ['Megatory Live export — Q3-2026 hospital layout'],
    [''],
    ['Save this file as MEGATORY_<HospitalCode> (example: Oak View → MEGATORY_OAKVW).'],
    ['Questions: Inventory@svp.vet or your Regional Operations Director.'],
    [''],
    ['What to fill in'],
    ['• Yellow idea: COUNT. Numbers only. Fractions are OK (1.75 bottles, 0.33 of a case).'],
    ['• "one box" → 1.  "one and three fourths bottles" → 1.75.'],
    ['• You may change COUNT TYPE to PACK/BUNDLE if you counted a carton instead of a single box.'],
    ['• Controlled (DEA, light blue in the master): enter exact pills or mLs in COUNT, then the log balance in LOG #1.'],
    [''],
    ['How to count common things'],
    ['• Pharmacy bottles / injectables: count by the bottle. Half-full + unopened = 1.5.'],
    ['• Heartworm / flea / tick: count display boxes unless PACK UNITS says otherwise.'],
    ['• Vaccines: count by the tray. 2 full 25-dose trays + 10 leftover doses = 2.4. Put brand in Manufacturer.'],
    ['• Pet food: count bags or cases. 4 cans of a 12-pack case = 0.33.'],
    ['• Lab tests: count as a fraction of the pack (12 of a 25-count box = 0.5).'],
    ['• White goods (caps, catheters, grooming) do not need to be counted.'],
    [''],
    ['Write-ins'],
    ['• Prefer a close existing line over a write-in.'],
    ['• Truly new items go in the !!SELECT GL!! rows at the bottom of INVENTORY SHEET.'],
    ['  Example: Cephalexin 250 mg, 500 count bottle, quantity 0.5'],
    [''],
    ['The three tabs'],
    ['• Instructions — this page'],
    ['• INVENTORY SHEET — the count (this is the one you turn in)'],
    ['• CATEGORIES — roll-up by SVP GL'],
    [''],
    ['Columns (INVENTORY SHEET)'],
    ...TEMPLATE_COLUMNS.map((c, i) => [
      String.fromCharCode(65 + i),
      c,
      c === 'COUNT' || c === 'COUNT TYPE' || c === 'LOG #1' ? 'EDITABLE' : 'LOCKED in master',
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 8 }, { wch: 40 }, { wch: 22 }];
  return ws;
}

function buildCategoriesSheet(items: InventoryItem[]): XLSX.WorkSheet {
  const sums = new Map<string, number>();
  for (const cat of SVP_GL_CATEGORIES) sums.set(cat, 0);
  for (const item of items) {
    const gl = item.svpGl;
    if (!gl || gl === WRITE_IN_GL) continue;
    const prev = sums.get(gl);
    if (prev === undefined) sums.set(gl, item.quantityOnHand || 0);
    else sums.set(gl, prev + (item.quantityOnHand || 0));
  }
  const aoa: (string | number)[][] = [
    ['Category', 'Current Count'],
    ...SVP_GL_CATEGORIES.map(cat => [cat, sums.get(cat) || '']),
    ['', ''],
    ['Total', items.reduce((s, i) => s + (i.quantityOnHand || 0), 0) || ''],
    ['Check', ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 32 }, { wch: 16 }];
  return ws;
}

export function generateExcelBuffer(items: InventoryItem[]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  // Same tab order as MEGATORY_HOSPITAL CODE 3Q2026 FINAL.xlsx
  XLSX.utils.book_append_sheet(wb, buildInstructionsSheet(), INSTRUCTIONS_SHEET);
  XLSX.utils.book_append_sheet(wb, buildInventorySheet(items), INVENTORY_SHEET);
  XLSX.utils.book_append_sheet(wb, buildCategoriesSheet(items), CATEGORIES_SHEET);
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return out;
}

function looksLikeHeaderCell(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function findHeaderRow(rows: unknown[][]): number {
  const needed = ['ITEM DESCRIPTION', 'COUNT'];
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const cells = (rows[i] || []).map(looksLikeHeaderCell);
    if (needed.every(n => cells.includes(n))) return i;
  }
  // Older VetCount files used Quantity On Hand instead of COUNT
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const cells = (rows[i] || []).map(looksLikeHeaderCell);
    if (cells.includes('ITEM DESCRIPTION') || cells.includes('DRUG NAME') || cells.includes('SKU')) return i;
  }
  return 0;
}

function headerKey(raw: unknown): string {
  return String(raw ?? '').trim();
}

function pickInventorySheet(wb: XLSX.WorkBook): string | undefined {
  if (wb.SheetNames.includes(INVENTORY_SHEET)) return INVENTORY_SHEET;
  if (wb.SheetNames.includes('Inventory Count')) return 'Inventory Count';
  return wb.SheetNames.find(n => n !== INSTRUCTIONS_SHEET && n !== CATEGORIES_SHEET) || wb.SheetNames[0];
}

export function parseExcelBuffer(buffer: ArrayBuffer): InventoryItem[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetName = pickInventorySheet(wb);
  if (!sheetName) return [];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: '', raw: true });
  if (!rows.length) return [];

  const headerIndex = findHeaderRow(rows);
  const header = (rows[headerIndex] || []).map(headerKey);
  const items: InventoryItem[] = [];

  for (let r = headerIndex + 1; r < rows.length; r++) {
    const line = rows[r] || [];
    const record: Record<string, unknown> = {};
    header.forEach((h, i) => {
      if (!h) return;
      record[h] = line[i];
    });
    const item = templateRowToItem(record);
    const gl = (item.svpGl || '').trim();
    const name = (item.drugName || '').trim();
    if (!name) continue; // skip blank write-in rows and title leftovers
    if (gl === WRITE_IN_GL && !name) continue;
    items.push(item);
  }
  return items;
}

export function megatoryExportFilename(hospitalCode: string, period = '3Q2026'): string {
  const code = (hospitalCode || 'HOSPITAL')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase() || 'HOSPITAL';
  return `MEGATORY_${code}_${period}.xlsx`;
}

export function downloadExcel(items: InventoryItem[], filename = 'MEGATORY_HOSPITAL_3Q2026.xlsx') {
  const buffer = generateExcelBuffer(items);
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function generateTemplateBuffer(): ArrayBuffer {
  return generateExcelBuffer([]);
}
