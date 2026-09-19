import AsyncStorage from '@react-native-async-storage/async-storage';
import { InventoryItem } from '../domain/inventory';

/**
 * Storage keys are namespaced `megatory_live_*` (the product name).
 *
 * Devices that already counted under the previous `vetcount_*` keys must NOT
 * lose their data, so the legacy keys are read once and copied forward on
 * first access. The legacy keys are left in place — migration is additive and
 * reversible, and `clearInventory` is the only place that removes anything.
 */
export const STORAGE_KEYS = {
  inventory: 'megatory_live_inventory_v1',
  meta: 'megatory_live_meta_v1',
} as const;

const LEGACY_KEYS = {
  inventory: 'vetcount_inventory_v1',
  meta: 'vetcount_meta_v1',
} as const;

const KEY = STORAGE_KEYS.inventory;
const META_KEY = STORAGE_KEYS.meta;

export interface StorageMeta {
  deviceName: string;
  lastExportAt?: string;
  totalCounts: number;
}

let migration: Promise<void> | null = null;

async function copyLegacyDataForward(): Promise<void> {
  if ((await AsyncStorage.getItem(KEY)) !== null) return; // already migrated / fresh install
  const legacyItems = await AsyncStorage.getItem(LEGACY_KEYS.inventory);
  if (legacyItems === null) return; // nothing to migrate
  await AsyncStorage.setItem(KEY, legacyItems);
  const legacyMeta = await AsyncStorage.getItem(LEGACY_KEYS.meta);
  if (legacyMeta !== null) {
    await AsyncStorage.setItem(META_KEY, legacyMeta);
  }
}

/** Idempotent, runs at most once per app process. Never throws. */
export async function migrateLegacyStorage(): Promise<void> {
  if (!migration) {
    migration = copyLegacyDataForward().catch((e) => {
      console.warn('Legacy storage migration failed; continuing without it', e);
    });
  }
  return migration;
}

export async function loadInventory(): Promise<InventoryItem[]> {
  try {
    await migrateLegacyStorage();
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to load inventory', e);
    return [];
  }
}

export async function saveInventory(items: InventoryItem[]): Promise<void> {
  await migrateLegacyStorage();
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
  const meta = await loadMeta();
  await AsyncStorage.setItem(META_KEY, JSON.stringify({ ...meta, totalCounts: items.length }));
}

export async function loadMeta(): Promise<StorageMeta> {
  try {
    await migrateLegacyStorage();
    const raw = await AsyncStorage.getItem(META_KEY);
    if (!raw) return { deviceName: 'Phone', totalCounts: 0 };
    return JSON.parse(raw);
  } catch {
    return { deviceName: 'Phone', totalCounts: 0 };
  }
}

export async function saveMeta(meta: StorageMeta): Promise<void> {
  await migrateLegacyStorage();
  await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
}

export async function clearInventory(): Promise<void> {
  // Remove the legacy keys too: otherwise a subsequent read would re-migrate
  // the old data back in and silently resurrect a "cleared" count.
  await AsyncStorage.multiRemove([KEY, META_KEY, LEGACY_KEYS.inventory, LEGACY_KEYS.meta]);
  migration = null;
}
