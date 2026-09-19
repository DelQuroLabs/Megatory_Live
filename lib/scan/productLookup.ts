/**
 * Fill what we can from free public catalogs. No API key, $0.
 * Hospital notebook always wins if the barcode is already there.
 */

export type ProductHint = {
  barcode: string;
  drugName: string;
  genericName: string;
  manufacturer: string;
  concentration: string;
  form: string;
  packUnits: string;
  source: 'openfda' | 'openproducts' | 'openfoodfacts' | 'duckduckgo' | 'none';
  sourceLabel: string;
};

export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

export function emptyHint(barcode: string): ProductHint {
  return {
    barcode,
    drugName: '',
    genericName: '',
    manufacturer: '',
    concentration: '',
    form: '',
    packUnits: '',
    source: 'none',
    sourceLabel: '',
  };
}

export function hintHasFill(hint: ProductHint): boolean {
  return Boolean(hint.drugName.trim() || hint.manufacturer.trim() || hint.genericName.trim());
}

export function digitsOnly(value: string): string {
  return String(value || '').replace(/\D/g, '');
}

/** Common NDC dash layouts so OpenFDA can match bottle numbers. */
export function ndcDashCandidates(digits: string): string[] {
  const d = digitsOnly(digits);
  const out: string[] = [];
  const push = (a: number, b: number, c: number) => {
    if (d.length !== a + b + c) return;
    out.push(`${d.slice(0, a)}-${d.slice(a, a + b)}-${d.slice(a + b)}`);
  };
  if (d.length === 11) push(5, 4, 2);
  if (d.length === 10) {
    push(5, 4, 1);
    push(5, 3, 2);
    push(4, 4, 2);
  }
  if (d.length === 12 && d.startsWith('0')) {
    return ndcDashCandidates(d.slice(1));
  }
  return Array.from(new Set(out));
}

export function mapDosageForm(raw: string): string {
  const s = String(raw || '').toLowerCase();
  if (!s) return '';
  if (/inject|vial|ampule/.test(s)) return 'Injectable';
  if (/chew/.test(s)) return 'Chewable';
  if (/tablet|tab\b/.test(s)) return 'Tablet';
  if (/capsule|caplet/.test(s)) return 'Capsule';
  if (/oint/.test(s)) return 'Ointment';
  if (/cream/.test(s)) return 'Cream';
  if (/powder/.test(s)) return 'Powder';
  if (/suspension/.test(s)) return 'Suspension';
  if (/solution|liquid|syrup|oral/.test(s)) return 'Liquid';
  return '';
}

function firstString(...vals: unknown[]): string {
  for (const v of vals) {
    if (Array.isArray(v) && v[0]) {
      const s = String(v[0]).trim();
      if (s) return s;
    }
    if (v != null && !Array.isArray(v)) {
      const s = String(v).trim();
      if (s) return s;
    }
  }
  return '';
}

export function mapOpenFda(record: Record<string, unknown>, barcode: string): ProductHint {
  const openfda = (record.openfda && typeof record.openfda === 'object')
    ? record.openfda as Record<string, unknown>
    : {};
  const ingredients = Array.isArray(record.active_ingredients)
    ? record.active_ingredients as Array<Record<string, unknown>>
    : [];
  const packs = Array.isArray(record.packaging)
    ? record.packaging as Array<Record<string, unknown>>
    : [];
  return {
    barcode,
    drugName: firstString(record.brand_name, openfda.brand_name, record.generic_name),
    genericName: firstString(record.generic_name, openfda.generic_name),
    manufacturer: firstString(record.labeler_name, openfda.manufacturer_name),
    concentration: firstString(ingredients[0]?.strength),
    form: mapDosageForm(firstString(record.dosage_form, openfda.dosage_form)),
    packUnits: firstString(packs[0]?.description, record.packaging_type),
    source: 'openfda',
    sourceLabel: 'openFDA',
  };
}

export function mapOpenProducts(product: Record<string, unknown>, barcode: string, source: 'openproducts' | 'openfoodfacts'): ProductHint {
  return {
    barcode,
    drugName: firstString(product.product_name, product.generic_name),
    genericName: firstString(product.generic_name),
    manufacturer: firstString(product.brands, product.brand_owner),
    concentration: '',
    form: '',
    packUnits: firstString(product.quantity),
    source,
    sourceLabel: source === 'openfoodfacts' ? 'Open Food Facts' : 'Open Products Facts',
  };
}

export function mapDuckDuckGo(data: Record<string, unknown>, barcode: string): ProductHint {
  const heading = firstString(data.Heading);
  const abstract = firstString(data.AbstractText);
  if (!heading && !abstract) return emptyHint(barcode);
  return {
    ...emptyHint(barcode),
    barcode,
    drugName: heading || abstract.slice(0, 80),
    genericName: heading && abstract ? abstract.slice(0, 120) : '',
    source: 'duckduckgo',
    sourceLabel: 'DuckDuckGo',
  };
}

async function fetchJson(url: string, fetchImpl: FetchLike, ms = 7000): Promise<unknown | null> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer = setTimeout(() => ctrl?.abort(), ms);
  try {
    const res = await fetchImpl(url, ctrl ? { signal: ctrl.signal } : undefined);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
}

export async function lookupProductOnline(
  barcode: string,
  fetchImpl: FetchLike = fetch as FetchLike,
): Promise<ProductHint> {
  const code = String(barcode || '').trim();
  if (!code) return emptyHint(code);
  const digits = digitsOnly(code);

  const fdaQueries: string[] = [];
  if (digits) {
    fdaQueries.push(`openfda.upc:"${digits}"`);
    for (const ndc of ndcDashCandidates(digits)) {
      fdaQueries.push(`packaging.package_ndc:"${ndc}"`);
      fdaQueries.push(`product_ndc:"${ndc}"`);
    }
  }

  for (const q of fdaQueries.slice(0, 4)) {
    const url = `https://api.fda.gov/drug/ndc.json?search=${encodeURIComponent(q)}&limit=1`;
    const json = asRecord(await fetchJson(url, fetchImpl));
    const results = Array.isArray(json?.results) ? json!.results : [];
    const rec = asRecord(results[0]);
    if (rec) {
      const hint = mapOpenFda(rec, code);
      if (hintHasFill(hint)) return hint;
    }
  }

  if (digits.length >= 8) {
    const productsUrl = `https://world.openproductsfacts.org/api/v2/product/${digits}.json`;
    const products = asRecord(await fetchJson(productsUrl, fetchImpl));
    if (products && Number(products.status) === 1) {
      const product = asRecord(products.product);
      if (product) {
        const hint = mapOpenProducts(product, code, 'openproducts');
        if (hintHasFill(hint)) return hint;
      }
    }

    const foodUrl = `https://world.openfoodfacts.org/api/v2/product/${digits}.json`;
    const food = asRecord(await fetchJson(foodUrl, fetchImpl));
    if (food && Number(food.status) === 1) {
      const product = asRecord(food.product);
      if (product) {
        const hint = mapOpenProducts(product, code, 'openfoodfacts');
        if (hintHasFill(hint)) return hint;
      }
    }
  }

  const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(`${digits || code} veterinary medication`)}&format=json&no_html=1&skip_disambig=1`;
  const ddg = asRecord(await fetchJson(ddgUrl, fetchImpl, 5000));
  if (ddg) {
    const hint = mapDuckDuckGo(ddg, code);
    if (hintHasFill(hint)) return hint;
  }

  return emptyHint(code);
}
