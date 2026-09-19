import * as XLSX from '@e965/xlsx';
import { InventoryItem, TEMPLATE_COLUMNS, itemToTemplateRow, templateRowToItem } from '../domain/inventory';

// Generate Excel file buffer from inventory
export function generateExcelBuffer(items: InventoryItem[]): ArrayBuffer {
  const rows = items.map(itemToTemplateRow);
  
  // Ensure columns in exact order
  const orderedRows = rows.map(r => {
    const o: any = {};
    TEMPLATE_COLUMNS.forEach(col => {
      o[col] = r[col];
    });
    return o;
  });

  const ws = XLSX.utils.json_to_sheet(orderedRows, { header: [...TEMPLATE_COLUMNS] });
  
  // Set column widths for readability
  const colWidths = [
    { wch: 14 }, // SKU
    { wch: 22 }, // MANUFACTURER
    { wch: 24 }, // MANUFACTURER NUMBER
    { wch: 48 }, // ITEM DESCRIPTION
    { wch: 12 }, // PACK PRICE
    { wch: 12 }, // PACK TYPE
    { wch: 12 }, // PACK UNIT
    { wch: 12 }, // COUNT TYPE
    { wch: 10 }, // COUNT - editable count
    { wch: 12 }, // ITEM PRICE
    { wch: 14 }, // VALUE ON HAND
    { wch: 10 }, // LOG 1
    { wch: 10 }, // LOG 2
    { wch: 10 }, // LOG 3
    { wch: 10 }, // LOG 4
    { wch: 10 }, // LOG 5
  ];
  ws['!cols'] = colWidths;

  // Add instruction row at top? We'll add a second sheet with instructions
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory Count');

  const instructionData = [
    ['Megatory Live Inventory Template - Instructions'],
    [''],
    ['This file is designed to match your protected master template.'],
    ['- Only edit the COUNT column (the ninth master column) in your master file.'],
    ['- All other columns are reference only in this export.'],
    ['- Item description, manufacturer number, and manufacturer are auto-filled from scans.'],
    ['- When using multiple phones, each phone exports its partial count.'],
    ['- To compile: Import all partial files using Merge in the app, then export final.'],
    ['- Final export can be copy-pasted into your protected master template.'],
    [''],
    ['Columns:'],
    ...TEMPLATE_COLUMNS.map((c, i) => [String.fromCharCode(65+i), c, i===8 ? 'EDITABLE' : 'LOCKED in master']),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(instructionData);
  ws2['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return out;
}

export function parseExcelBuffer(buffer: ArrayBuffer): InventoryItem[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  // Prefer sheet named Inventory Count, else first sheet
  const sheetName = wb.SheetNames.includes('Inventory Count') ? 'Inventory Count' : wb.SheetNames[0];
  if (!sheetName) return [];
  const ws = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
  if (json.length === 0) return [];
  
  // Detect if first row is header mismatch - json_to_sheet uses first row as keys
  // Convert each row to InventoryItem using tolerant parser
  return json.map(row => templateRowToItem(row));
}

// For web: trigger download
export function downloadExcel(items: InventoryItem[], filename = 'vet-inventory.xlsx') {
  const buffer = generateExcelBuffer(items);
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Helper to generate template file (empty)
export function generateTemplateBuffer(): ArrayBuffer {
  return generateExcelBuffer([]);
}
