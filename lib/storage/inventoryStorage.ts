import AsyncStorage from '@react-native-async-storage/async-storage';
import { InventoryItem } from '../domain/inventory';

const KEY = 'vetcount_inventory_v1';
const META_KEY = 'vetcount_meta_v1';

export interface StorageMeta {
  deviceName: string;
  lastExportAt?: string;
  totalCounts: number;
}

export async function loadInventory(): Promise<InventoryItem[]> {
  try {
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
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
  const meta = await loadMeta();
  await AsyncStorage.setItem(META_KEY, JSON.stringify({ ...meta, totalCounts: items.length }));
}

export async function loadMeta(): Promise<StorageMeta> {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    if (!raw) return { deviceName: 'Phone', totalCounts: 0 };
    return JSON.parse(raw);
  } catch {
    return { deviceName: 'Phone', totalCounts: 0 };
  }
}

export async function saveMeta(meta: StorageMeta): Promise<void> {
  await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
}

export async function clearInventory(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
