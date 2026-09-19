import * as XLSX from '@e965/xlsx';
import { createEmptyItem, TEMPLATE_COLUMNS, MASTER_SHEET_NAMES, WRITE_IN_GL } from '../lib/domain/inventory';
import { generateExcelBuffer, parseExcelBuffer, megatoryExportFilename } from '../lib/storage/excel';

describe('Q3-2026 MEGATORY hospital Excel layout', () => {
  test('export uses the three hospital tabs, not made-up names', () => {
    const workbook = XLSX.read(generateExcelBuffer([]), { type: 'array' });
    expect(workbook.SheetNames).toEqual([
      MASTER_SHEET_NAMES.instructions,
      MASTER_SHEET_NAMES.inventory,
      MASTER_SHEET_NAMES.categories,
    ]);
  });

  test('INVENTORY SHEET has the title row, letter row, then the master headers', () => {
    const item = createEmptyItem({
      svpGl: 'Pharmacy Rx Oral/Topical',
      barcode: '00881234',
      drugName: 'Carprofen',
      manufacturer: 'Example Vet',
      form: 'Tablet',
      packUnits: '100',
      countType: 'EACH',
      quantityOnHand: 7,
    });
    const workbook = XLSX.read(generateExcelBuffer([item]), { type: 'array' });
    const sheet = workbook.Sheets[MASTER_SHEET_NAMES.inventory];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });

    expect(String(rows[0][1])).toMatch(/JUNE 2026-SEPTEMBER 2026/i);
    expect(rows[1][0]).toBe('E');
    expect(rows[2][0]).toBe('SVP GL');
    expect(rows[2][3]).toBe('ITEM DESCRIPTION');
    expect(rows[2][6]).toBe('PACK UNITS');
    expect(rows[2][8]).toBe('COUNT');
    expect(rows[2][12]).toBe('LOG #1');

    const data = rows[3];
    expect(data[0]).toBe('Pharmacy Rx Oral/Topical');
    expect(data[3]).toBe('Carprofen');
    expect(data[8]).toBe(7);
  });

  test('uncounted rows leave COUNT blank instead of writing 0', () => {
    const item = createEmptyItem({
      svpGl: 'Pharmacy Injectable',
      drugName: 'Alfaxan 10mL',
      barcode: '10026696',
      quantityOnHand: 0,
    });
    const workbook = XLSX.read(generateExcelBuffer([item]), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[MASTER_SHEET_NAMES.inventory], { header: 1, defval: '' });
    expect(rows[3][8]).toBe('');
  });

  test('import skips the three header rows and reads COUNT + LOG #1', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['', 'PLEASE USE THIS VERSION FOR JUNE 2026-SEPTEMBER 2026 INVENTORY COUNTS'],
      ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', '', '!LOG #1 is Required!'],
      [...TEMPLATE_COLUMNS.slice(0, 11), '', 'LOG #1', 'LOG #2', 'LOG #3', 'LOG #4', 'LOG #5'],
      ['Pharmacy Injectable', 'Zoetis', '10026696', 'Alfaxan 10mL', '$50.17', 'ml', '10.00', 'EACH', 1.75, '$5.02', '', '', '12'],
      [WRITE_IN_GL, '', '', '', '', 'NA', 1, 'PACK/BUNDLE', '', '', '', '', ''],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, MASTER_SHEET_NAMES.inventory);
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const [item] = parseExcelBuffer(buffer);
    expect(item).toMatchObject({
      barcode: '10026696',
      drugName: 'Alfaxan 10mL',
      manufacturer: 'Zoetis',
      svpGl: 'Pharmacy Injectable',
      quantityOnHand: 1.75,
      log1: '12',
    });
  });

  test('legacy Inventory Count / SKU files still import', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['SKU', 'MANUFACTURER', 'MANUFACTURER NUMBER', 'ITEM DESCRIPTION', 'PACK PRICE', 'PACK TYPE', 'PACK UNIT', 'COUNT TYPE', 'COUNT', 'ITEM PRICE', 'VALUE ON HAND', 'LOG 1', 'LOG 2', 'LOG 3', 'LOG 4', 'LOG 5'],
      ['sku-2', 'Example Vet', '008899', 'Meloxicam', '', 'Tablet', '100', 'tablet', 12, '', '', '', '', '', '', ''],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Inventory Count');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const [item] = parseExcelBuffer(buffer);
    expect(item).toMatchObject({ id: 'sku-2', barcode: '008899', drugName: 'Meloxicam', manufacturer: 'Example Vet', quantityOnHand: 12 });
  });

  test('filename follows MEGATORY_<HospitalCode>_3Q2026', () => {
    expect(megatoryExportFilename('Oak View')).toBe('MEGATORY_OAK_VIEW_3Q2026.xlsx');
    expect(megatoryExportFilename('OAKVW')).toBe('MEGATORY_OAKVW_3Q2026.xlsx');
    expect(megatoryExportFilename('')).toBe('MEGATORY_HOSPITAL_3Q2026.xlsx');
  });

  test('CATEGORIES tab lists every SVP GL from the master', () => {
    const workbook = XLSX.read(generateExcelBuffer([]), { type: 'array' });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[MASTER_SHEET_NAMES.categories], { header: 1, defval: '' });
    expect(rows[0]).toEqual(['Category', 'Current Count']);
    expect(rows.map(r => r[0])).toEqual(expect.arrayContaining(['Pharmacy Rx Oral/Topical', 'Vaccination', 'Dietary Prescription']));
  });
});
