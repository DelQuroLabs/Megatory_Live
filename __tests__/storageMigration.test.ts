/**
 * VetCount -> Megatory Live storage rename.
 *
 * The AsyncStorage keys moved from `vetcount_*` to `megatory_live_*`. Any
 * device that already counted holds data under the old keys, so the rename has
 * to carry it forward. These tests exist because a naive rename silently wipes
 * a practice's in-progress count.
 */
const store: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => (key in store ? store[key] : null)),
    setItem: jest.fn(async (key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn(async (key: string) => { delete store[key]; }),
    multiRemove: jest.fn(async (keys: string[]) => { keys.forEach((k) => { delete store[k]; }); }),
  },
}));

const NEW_KEY = 'megatory_live_inventory_v1';
const NEW_META = 'megatory_live_meta_v1';
const OLD_KEY = 'vetcount_inventory_v1';
const OLD_META = 'vetcount_meta_v1';

function freshStorage() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../lib/storage/inventoryStorage');
}

beforeEach(() => {
  Object.keys(store).forEach((k) => { delete store[k]; });
});

describe('legacy storage migration', () => {
  test('carries inventory and meta forward from the vetcount keys', async () => {
    store[OLD_KEY] = JSON.stringify([{ id: 'a', drugName: 'Amoxicillin', quantityOnHand: 12 }]);
    store[OLD_META] = JSON.stringify({ deviceName: 'Pharmacy-iPad', totalCounts: 1 });

    const storage = freshStorage();
    const items = await storage.loadInventory();
    const meta = await storage.loadMeta();

    expect(items).toHaveLength(1);
    expect(items[0].drugName).toBe('Amoxicillin');
    expect(meta.deviceName).toBe('Pharmacy-iPad');
    expect(store[NEW_KEY]).toBe(store[OLD_KEY]);
  });

  test('never overwrites data already stored under the new key', async () => {
    store[NEW_KEY] = JSON.stringify([{ id: 'new', drugName: 'Current count' }]);
    store[OLD_KEY] = JSON.stringify([{ id: 'old', drugName: 'Stale count' }]);

    const storage = freshStorage();
    const items = await storage.loadInventory();

    expect(items).toHaveLength(1);
    expect(items[0].drugName).toBe('Current count');
  });

  test('leaves the legacy keys in place so the migration is reversible', async () => {
    store[OLD_KEY] = JSON.stringify([{ id: 'a' }]);

    const storage = freshStorage();
    await storage.loadInventory();

    expect(store[OLD_KEY]).toBeDefined();
  });

  test('clear removes legacy keys too, so a cleared count cannot be resurrected', async () => {
    store[OLD_KEY] = JSON.stringify([{ id: 'a', drugName: 'Amoxicillin' }]);
    store[OLD_META] = JSON.stringify({ deviceName: 'Phone', totalCounts: 1 });

    const storage = freshStorage();
    await storage.loadInventory(); // migrate
    await storage.clearInventory();

    const after: { loadInventory: () => Promise<unknown[]>; loadMeta: () => Promise<any> } = freshStorage();
    expect(await after.loadInventory()).toEqual([]);
    expect((await after.loadMeta()).deviceName).toBe('Phone'); // default, not migrated back
  });

  test('a fresh install with no legacy data simply starts empty', async () => {
    const storage = freshStorage();
    expect(await storage.loadInventory()).toEqual([]);
    expect(store[NEW_KEY]).toBeUndefined();
  });
});
