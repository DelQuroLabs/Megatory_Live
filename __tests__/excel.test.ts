import * as XLSX from 'xlsx';
import { createEmptyItem, TEMPLATE_COLUMNS } from '../lib/domain/inventory';
import { generateExcelBuffer, parseExcelBuffer } from '../lib/storage/excel';

describe('protected master Excel layout', () => {
  test('export uses the supplied 16-column header order and editable COUNT field', () => {
    const item = createEmptyItem({
      id: 'sku-1',
      barcode: '00881234',
      drugName: 'Carprofen',
      manufacturer: 'Example Vet',
      form: 'Tablet',
      packageSize: '100',
      unit: 'tablet',
      quantityOnHand: 7,
    });
    const workbook = XLSX.read(generateExcelBuffer([item]), { type: 'array' });
    const sheet = workbook.Sheets['Inventory Count'];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1, defval: '' });
    expect(rows[0]).toEqual([...TEMPLATE_COLUMNS]);
    expect(rows[1][0]).toBe('sku-1');
    expect(rows[1][3]).toBe('Carprofen');
    expect(rows[1][8]).toBe(7);
    expect(rows[1]).toHaveLength(16);
  });

  test('import reads COUNT and the supplied master headers', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      [...TEMPLATE_COLUMNS],
      ['sku-2', 'Example Vet', '008899', 'Meloxicam', '', 'Tablet', '100', 'tablet', 12, '', '', '', '', '', '', ''],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Inventory Count');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const [item] = parseExcelBuffer(buffer);
    expect(item).toMatchObject({ id: 'sku-2', barcode: '008899', drugName: 'Meloxicam', manufacturer: 'Example Vet', quantityOnHand: 12 });
  });
});
