// Framework-independent domain models for veterinary inventory
// MUST NOT import React, React Native, Expo, etc.

export type DrugForm =
  | 'Tablet'
  | 'Capsule'
  | 'Chewable'
  | 'Liquid'
  | 'Injectable'
  | 'Ointment'
  | 'Cream'
  | 'Powder'
  | 'Suspension'
  | 'Solution'
  | 'Spot-On'
  | 'Collar'
  | 'Other';

export type DrugCategory =
  | 'Antibiotic'
  | 'NSAID'
  | 'Analgesic'
  | 'Sedative/Anesthesia'
  | 'Antiparasitic'
  | 'Vaccine'
  | 'Fluid'
  | 'Controlled Substance'
  | 'Compounded'
  | 'Supplement'
  | 'OTC'
  | 'Other';

export type Location =
  | 'Main Pharmacy'
  | 'Surgery'
  | 'Exam 1'
  | 'Exam 2'
  | 'Exam 3'
  | 'Exam 4'
  | 'ICU'
  | 'Lab'
  | 'Refrigerator'
  | 'Controlled Cabinet'
  | 'OTC Shelf'
  | 'Warehouse'
  | 'Other';

export interface InventoryItem {
  id: string; // uuid
  barcode: string; // scanned barcode / NDC / UPC
  drugName: string; // brand name
  genericName: string;
  manufacturer: string;
  concentration: string; // e.g. 100mg/mL, 50mg
  form: DrugForm;
  packageSize: string; // e.g. 100ct, 30mL bottle
  category: DrugCategory;
  location: Location;
  expirationDate: string; // ISO date string YYYY-MM-DD or empty
  lotNumber: string;
  controlled: boolean;
  controlledSchedule?: string; // II, III, IV, V
  unit: string; // bottle, box, vial, tablet, mL
  quantityOnHand: number; // current counted quantity
  countedBy: string; // device/person identifier
  lastCountedAt: string; // ISO timestamp
  notes: string;
}

export const TEMPLATE_COLUMNS = [
  'SKU',
  'MANUFACTURER',
  'MANUFACTURER NUMBER',
  'ITEM DESCRIPTION',
  'PACK PRICE',
  'PACK TYPE',
  'PACK UNIT',
  'COUNT TYPE',
  'COUNT',
  'ITEM PRICE',
  'VALUE ON HAND',
  'LOG 1',
  'LOG 2',
  'LOG 3',
  'LOG 4',
  'LOG 5',
] as const;
export type TemplateColumn = typeof TEMPLATE_COLUMNS[number];

export function createEmptyItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    barcode: '',
    drugName: '',
    genericName: '',
    manufacturer: '',
    concentration: '',
    form: 'Other',
    packageSize: '',
    category: 'Other',
    location: 'Main Pharmacy',
    expirationDate: '',
    lotNumber: '',
    controlled: false,
    controlledSchedule: '',
    unit: 'bottle',
    quantityOnHand: 0,
    countedBy: '',
    lastCountedAt: now,
    notes: '',
    ...overrides,
  };
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

export function itemToTemplateRow(item: InventoryItem): Record<TemplateColumn, string | number> {
  // This is the protected master layout supplied by the user (16 columns).
  // Fields not represented by the master remain intentionally blank rather than
  // inventing values that could overwrite protected reference data.
  return {
    'SKU': item.id,
    'MANUFACTURER': item.manufacturer,
    'MANUFACTURER NUMBER': item.barcode,
    'ITEM DESCRIPTION': item.drugName,
    'PACK PRICE': '',
    'PACK TYPE': item.form,
    'PACK UNIT': item.packageSize,
    'COUNT TYPE': item.unit,
    'COUNT': item.quantityOnHand,
    'ITEM PRICE': '',
    'VALUE ON HAND': '',
    'LOG 1': '',
    'LOG 2': '',
    'LOG 3': '',
    'LOG 4': '',
    'LOG 5': '',
  };
}
export function templateRowToItem(row: Record<string, any>): InventoryItem {
  // tolerant parsing - handles both our template and user variations
  const get = (keys: string[]) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null) return String(row[k]).trim();
      // case-insensitive fallback
      const found = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase());
      if (found) return String(row[found]).trim();
    }
    return '';
  };
  const getNum = (keys: string[]) => {
    const v = get(keys);
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  };

  return {
    id: get(['SKU', 'Item ID', 'ID', 'ItemID']) || generateId(),
    barcode: get(['MANUFACTURER NUMBER', 'Barcode', 'Bar Code', 'NDC', 'UPC']),
    drugName: get(['ITEM DESCRIPTION', 'Drug Name', 'Drug', 'Name', 'Brand Name']),
    genericName: get(['Generic Name', 'Generic']),
    manufacturer: get(['MANUFACTURER', 'Manufacturer', 'Mfr']),
    concentration: get(['Strength/Concentration', 'Strength', 'Concentration']),
    form: (get(['PACK TYPE', 'Form']) as DrugForm) || 'Other',
    packageSize: get(['PACK UNIT', 'Package Size', 'Size', 'Package']),
    category: (get(['Category']) as DrugCategory) || 'Other',
    location: (get(['Location', 'Loc']) as Location) || 'Main Pharmacy',
    expirationDate: get(['Expiration Date', 'Exp Date', 'Expiration']),
    lotNumber: get(['Lot Number', 'Lot']),
    controlled: get(['Controlled (Y/N)', 'Controlled']).toUpperCase() === 'Y',
    controlledSchedule: get(['Controlled Schedule', 'Schedule']),
    unit: get(['COUNT TYPE', 'Unit', 'UOM']) || 'bottle',
    quantityOnHand: getNum(['COUNT', 'Quantity On Hand', 'Qty', 'Quantity', 'Count', 'On Hand']),
    countedBy: get(['Counted By', 'CountedBy']),
    lastCountedAt: get(['Last Counted', 'LastCounted']) || new Date().toISOString(),
    notes: get(['Notes', 'Note']),
  };
}

export function mergeInventories(
  base: InventoryItem[],
  incoming: InventoryItem[],
  strategy: 'add' | 'replace' = 'add'
): { merged: InventoryItem[]; added: number; updated: number } {
  const map = new Map<string, InventoryItem>();
  const nameMap = new Map<string, string>(); // normalized name -> key
  base.forEach(item => {
    // key by barcode if present, else id
    const key = item.barcode ? `bc:${item.barcode}` : `id:${item.id}`;
    map.set(key, item);
    if (item.drugName) {
      nameMap.set(normalizeName(item.drugName), key);
    }
  });

  let added = 0;
  let updated = 0;

  incoming.forEach(inItem => {
    // Try barcode first, then id, then fuzzy name match
    let key: string | undefined;
    let existing: InventoryItem | undefined;

    if (inItem.barcode) {
      key = `bc:${inItem.barcode}`;
      existing = map.get(key);
    }
    if (!existing && inItem.id) {
      const idKey = `id:${inItem.id}`;
      existing = map.get(idKey);
      if (existing) key = idKey;
    }
    if (!existing && inItem.drugName) {
      const norm = normalizeName(inItem.drugName);
      const nameKey = nameMap.get(norm);
      if (nameKey) {
        existing = map.get(nameKey);
        key = nameKey;
      } else {
        // fuzzy: try contains
        for (const [n, k] of nameMap.entries()) {
          if (n.includes(norm) || norm.includes(n)) {
            existing = map.get(k);
            key = k;
            break;
          }
        }
      }
    }

    if (existing && key) {
      if (strategy === 'add') {
        map.set(key, {
          ...existing,
          // Keep original locked fields from base (template), only update qty and audit
          quantityOnHand: (existing.quantityOnHand || 0) + (inItem.quantityOnHand || 0),
          lastCountedAt: new Date().toISOString(),
          countedBy: inItem.countedBy || existing.countedBy,
          notes: inItem.notes ? `${existing.notes}; ${inItem.notes}`.replace(/^; /, '') : existing.notes,
          // If base had empty barcode but incoming has barcode, fill it
          barcode: existing.barcode || inItem.barcode,
        });
      } else {
        map.set(key, { 
          ...existing, 
          quantityOnHand: inItem.quantityOnHand,
          barcode: inItem.barcode || existing.barcode,
          lastCountedAt: new Date().toISOString(),
          countedBy: inItem.countedBy || existing.countedBy,
        });
      }
      updated++;
    } else {
      // New item - only name and qty required per user spec
      const newKey = inItem.barcode ? `bc:${inItem.barcode}` : `id:${inItem.id}`;
      map.set(newKey, inItem);
      if (inItem.drugName) {
        nameMap.set(normalizeName(inItem.drugName), newKey);
      }
      added++;
    }
  });

  return { merged: Array.from(map.values()), added, updated };
}

function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

export function validateItem(item: Partial<InventoryItem>): string[] {
  const errors: string[] = [];
  // Per user: only name and quantity required to make a record
  if (!item.drugName?.trim()) errors.push('Drug Name is required');
  if (item.quantityOnHand === undefined || item.quantityOnHand === null || String(item.quantityOnHand).trim() === '') errors.push('Quantity is required');
  if (item.quantityOnHand !== undefined && Number(item.quantityOnHand) < 0) errors.push('Quantity cannot be negative');
  // All other fields optional - will be matched/filled from template
  return errors;
}

// Smart matcher for template output: tries to align counted items (name+qty only) to template rows
export function matchToTemplate(
  templateItems: InventoryItem[],
  countedItems: InventoryItem[]
): { matched: Array<{ template: InventoryItem; counted: InventoryItem | null; quantity: number }>; unmatchedCounted: InventoryItem[] } {
  const countedByNorm = new Map<string, InventoryItem[]>();
  countedItems.forEach(c => {
    const norm = normalizeName(c.drugName);
    if (!countedByNorm.has(norm)) countedByNorm.set(norm, []);
    countedByNorm.get(norm)!.push(c);
  });

  const matched: Array<{ template: InventoryItem; counted: InventoryItem | null; quantity: number }> = [];
  const usedCountedIds = new Set<string>();

  templateItems.forEach(t => {
    const norm = normalizeName(t.drugName);
    let found: InventoryItem | undefined;
    // exact name match
    if (countedByNorm.has(norm)) {
      const candidates = countedByNorm.get(norm)!.filter(c => !usedCountedIds.has(c.id));
      if (candidates.length > 0) {
        found = candidates[0];
      }
    }
    // fuzzy contains
    if (!found) {
      for (const [cNorm, cItems] of countedByNorm.entries()) {
        if (cNorm.includes(norm) || norm.includes(cNorm)) {
          const candidate = cItems.find(c => !usedCountedIds.has(c.id));
          if (candidate) { found = candidate; break; }
        }
      }
    }
    // barcode match as fallback
    if (!found && t.barcode) {
      found = countedItems.find(c => c.barcode && c.barcode === t.barcode && !usedCountedIds.has(c.id));
    }

    if (found) {
      usedCountedIds.add(found.id);
      matched.push({ template: t, counted: found, quantity: found.quantityOnHand });
    } else {
      matched.push({ template: t, counted: null, quantity: t.quantityOnHand || 0 });
    }
  });

  const unmatchedCounted = countedItems.filter(c => !usedCountedIds.has(c.id));

  return { matched, unmatchedCounted };
}

// Common vet formulary for quick lookup fallback (synthetic, no real NDCs)
export const COMMON_VET_DRUGS: Array<Partial<InventoryItem> & { barcodes?: string[] }> = [
  { drugName: 'Carprofen', genericName: 'Carprofen', manufacturer: 'Putney', concentration: '100mg', form: 'Tablet', category: 'NSAID', unit: 'tablet', packageSize: '60ct' },
  { drugName: 'Meloxicam', genericName: 'Meloxicam', manufacturer: 'Boehringer', concentration: '1.5mg/mL', form: 'Liquid', category: 'NSAID', unit: 'bottle', packageSize: '10mL' },
  { drugName: 'Amoxicillin/Clavulanate', genericName: 'Amoxicillin Clavulanate', manufacturer: 'Dechra', concentration: '62.5mg', form: 'Tablet', category: 'Antibiotic', unit: 'tablet', packageSize: '30ct' },
  { drugName: 'Cerenia', genericName: 'Maropitant', manufacturer: 'Zoetis', concentration: '16mg', form: 'Tablet', category: 'Other', unit: 'tablet', packageSize: '4ct' },
  { drugName: 'Adequan', genericName: 'Polysulfated Glycosaminoglycan', manufacturer: 'American Regent', concentration: '100mg/mL', form: 'Injectable', category: 'Supplement', unit: 'vial', packageSize: '5mL' },
  { drugName: 'Convenia', genericName: 'Cefovecin', manufacturer: 'Zoetis', concentration: '80mg/mL', form: 'Injectable', category: 'Antibiotic', unit: 'vial', packageSize: '10mL' },
  { drugName: 'Buprenorphine', genericName: 'Buprenorphine', manufacturer: 'Par', concentration: '0.3mg/mL', form: 'Injectable', category: 'Controlled Substance', unit: 'vial', packageSize: '1mL', controlled: true, controlledSchedule: 'III' },
  { drugName: 'Gabapentin', genericName: 'Gabapentin', manufacturer: 'Generic', concentration: '100mg', form: 'Capsule', category: 'Analgesic', unit: 'capsule', packageSize: '100ct' },
];
