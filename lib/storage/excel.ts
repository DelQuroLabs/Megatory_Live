import * as XLSX from 'xlsx';
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
    { wch: 12 }, // ID
    { wch: 18 }, // Barcode
    { wch: 25 }, // Drug Name
    { wch: 25 }, // Generic
    { wch: 20 }, // Manufacturer
    { wch: 18 }, // Concentration
    { wch: 12 }, // Form
    { wch: 14 }, // Package Size
    { wch: 18 }, // Category
    { wch: 16 }, // Location
    { wch: 14 }, // Expiration
    { wch: 12 }, // Lot
    { wch: 14 }, // Controlled Y/N
    { wch: 10 }, // Schedule
    { wch: 10 }, // Unit
    { wch: 16 }, // Qty - highlighted as editable
    { wch: 14 }, // Counted By
    { wch: 20 }, // Last Counted
    { wch: 20 }, // Notes
  ];
  ws['!cols'] = colWidths;

  // Add instruction row at top? We'll add a second sheet with instructions
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory Count');

  const instructionData = [
    ['VetCount Inventory Template - Instructions'],
    [''],
    ['This file is designed to match your protected master template.'],
    ['- Only edit the Quantity On Hand column (Column P) in your master file.'],
    ['- All other columns are reference only in this export.'],
    ['- Drug Name, Barcode, Manufacturer etc are auto-filled from scans.'],
    ['- When using multiple phones, each phone exports its partial count.'],
    ['- To compile: Import all partial files using Merge in the app, then export final.'],
    ['- Final export can be copy-pasted into your protected master template.'],
    [''],
    ['Columns:'],
    ...TEMPLATE_COLUMNS.map((c, i) => [String.fromCharCode(65+i), c, i===15 ? 'EDITABLE' : 'LOCKED in master']),
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
