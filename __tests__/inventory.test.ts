import { createEmptyItem, itemToTemplateRow, templateRowToItem, mergeInventories, validateItem, TEMPLATE_COLUMNS, matchToTemplate } from '../lib/domain/inventory';

describe('Inventory Domain', () => {
  test('createEmptyItem generates id and defaults', () => {
    const item = createEmptyItem({ drugName: 'TestDrug' });
    expect(item.drugName).toBe('TestDrug');
    expect(item.id).toBeTruthy();
    expect(item.quantityOnHand).toBe(0);
  });

  test('itemToTemplateRow respects column order', () => {
    const item = createEmptyItem({ drugName: 'Carprofen', barcode: '123', quantityOnHand: 5 });
    const row = itemToTemplateRow(item);
    expect(row['Drug Name']).toBe('Carprofen');
    expect(row['Barcode']).toBe('123');
    expect(row['Quantity On Hand']).toBe(5);
    TEMPLATE_COLUMNS.forEach(col => {
      expect(row).toHaveProperty(col);
    });
  });

  test('templateRowToItem parses tolerant keys', () => {
    const row = {
      'Barcode': ' 12345 ',
      'Drug Name': 'Meloxicam',
      'Quantity On Hand': '10',
      'Controlled (Y/N)': 'Y',
    };
    const item = templateRowToItem(row);
    expect(item.barcode).toBe('12345');
    expect(item.drugName).toBe('Meloxicam');
    expect(item.quantityOnHand).toBe(10);
    expect(item.controlled).toBe(true);
  });

  test('mergeInventories adds quantities by barcode', () => {
    const base = [createEmptyItem({ barcode: 'A', drugName: 'Drug A', quantityOnHand: 5 })];
    const incoming = [createEmptyItem({ barcode: 'A', drugName: 'Drug A', quantityOnHand: 3 }), createEmptyItem({ barcode: 'B', drugName: 'Drug B', quantityOnHand: 2 })];
    const { merged, added, updated } = mergeInventories(base, incoming, 'add');
    expect(merged.length).toBe(2);
    const drugA = merged.find(i => i.barcode === 'A');
    expect(drugA?.quantityOnHand).toBe(8);
    expect(added).toBe(1);
    expect(updated).toBe(1);
  });

  test('mergeInventories matches by name when only name+qty provided (user spec)', () => {
    const base = [createEmptyItem({ drugName: 'Carprofen 100mg', barcode: '', quantityOnHand: 2 })];
    const incoming = [createEmptyItem({ drugName: 'Carprofen', barcode: '', quantityOnHand: 3 })]; // only name+qty
    const { merged, added, updated } = mergeInventories(base, incoming, 'add');
    expect(merged.length).toBe(1);
    expect(merged[0].quantityOnHand).toBe(5); // 2+3 matched by fuzzy name
    expect(added).toBe(0);
    expect(updated).toBe(1);
  });

  test('mergeInventories replace strategy', () => {
    const base = [createEmptyItem({ barcode: 'A', drugName: 'Drug A', quantityOnHand: 5 })];
    const incoming = [createEmptyItem({ barcode: 'A', drugName: 'Drug A', quantityOnHand: 3 })];
    const { merged } = mergeInventories(base, incoming, 'replace');
    expect(merged[0].quantityOnHand).toBe(3);
  });

  test('validateItem only requires name and qty (user spec)', () => {
    const empty = createEmptyItem({ drugName: '' });
    const errors = validateItem(empty);
    expect(errors.length).toBeGreaterThan(0);
    const onlyNameQty = createEmptyItem({ drugName: 'Good', quantityOnHand: 1 });
    // All other fields optional
    expect(validateItem(onlyNameQty).length).toBe(0);
    const noQty = createEmptyItem({ drugName: 'Good', quantityOnHand: undefined as any });
    expect(validateItem(noQty).length).toBeGreaterThan(0);
  });

  test('matchToTemplate aligns counted items to template by name', () => {
    const template = [
      createEmptyItem({ drugName: 'Carprofen 100mg Tablet', barcode: '111', quantityOnHand: 0 }),
      createEmptyItem({ drugName: 'Meloxicam 1.5mg/mL', barcode: '222', quantityOnHand: 0 }),
    ];
    const counted = [
      createEmptyItem({ drugName: 'Carprofen', quantityOnHand: 5 }),
      createEmptyItem({ drugName: 'Meloxicam', quantityOnHand: 3 }),
    ];
    const { matched, unmatchedCounted } = matchToTemplate(template, counted);
    expect(matched.length).toBe(2);
    expect(matched[0].quantity).toBe(5);
    expect(matched[1].quantity).toBe(3);
    expect(unmatchedCounted.length).toBe(0);
  });
});
