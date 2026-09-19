import {
  ndcDashCandidates,
  mapDosageForm,
  mapOpenFda,
  mapOpenProducts,
  mapDuckDuckGo,
  lookupProductOnline,
  hintHasFill,
  emptyHint,
  digitsOnly,
} from '../lib/scan/productLookup';

describe('productLookup mapping', () => {
  test('NDC dash candidates cover 5-4-2 for 11 digits', () => {
    expect(ndcDashCandidates('54771430201')).toContain('54771-4302-01');
  });

  test('dosage form maps injectables and tablets', () => {
    expect(mapDosageForm('Injection, solution')).toBe('Injectable');
    expect(mapDosageForm('TABLET')).toBe('Tablet');
  });

  test('OpenFDA record fills name, maker, strength', () => {
    const hint = mapOpenFda({
      brand_name: 'Alfaxan',
      generic_name: 'alfaxalone',
      labeler_name: 'Zoetis',
      dosage_form: 'Injection',
      active_ingredients: [{ strength: '10 mg/mL' }],
      packaging: [{ description: '10 mL vial' }],
    }, '10026696');
    expect(hint).toMatchObject({
      drugName: 'Alfaxan',
      genericName: 'alfaxalone',
      manufacturer: 'Zoetis',
      concentration: '10 mg/mL',
      form: 'Injectable',
      packUnits: '10 mL vial',
      source: 'openfda',
    });
    expect(hintHasFill(hint)).toBe(true);
  });

  test('Open Products Facts fills name and brand', () => {
    const hint = mapOpenProducts({
      product_name: 'Heartgard Plus',
      brands: 'Boehringer',
      quantity: '6',
    }, '012345', 'openproducts');
    expect(hint.drugName).toBe('Heartgard Plus');
    expect(hint.manufacturer).toBe('Boehringer');
  });

  test('DuckDuckGo uses Heading, empty when nothing', () => {
    expect(hintHasFill(mapDuckDuckGo({}, '1'))).toBe(false);
    expect(mapDuckDuckGo({ Heading: 'Carprofen' }, '1').drugName).toBe('Carprofen');
  });

  test('digitsOnly strips dashes', () => {
    expect(digitsOnly('00-10026-696')).toBe('0010026696');
  });
});

describe('lookupProductOnline', () => {
  test('uses OpenFDA when it returns a result', async () => {
    const fetchImpl = jest.fn(async (url: string) => {
      if (String(url).includes('api.fda.gov')) {
        return {
          ok: true,
          json: async () => ({
            results: [{ brand_name: 'Cerenia', labeler_name: 'Zoetis', generic_name: 'maropitant' }],
          }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });
    const hint = await lookupProductOnline('123', fetchImpl);
    expect(hint.drugName).toBe('Cerenia');
    expect(hint.source).toBe('openfda');
    expect(fetchImpl).toHaveBeenCalled();
  });

  test('falls through to none when every host fails', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error('offline');
    });
    const hint = await lookupProductOnline('999999', fetchImpl);
    expect(hint).toEqual(emptyHint('999999'));
  });
});
