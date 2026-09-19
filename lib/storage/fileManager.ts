import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

const BASE_DIR = FileSystem.documentDirectory + 'MegatoryLive/';
// Files written by earlier builds still live here. They stay visible in the
// file list so nothing already on a device disappears after the rename.
const LEGACY_BASE_DIR = FileSystem.documentDirectory + 'VetCount/';

export interface ManagedFile {
  name: string;
  uri: string;
  size: number;
  modified: number;
  isTemplate: boolean;
}

export async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(BASE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(BASE_DIR, { intermediates: true });
  }
}

export async function saveFileToManaged(name: string, base64Data: string): Promise<string> {
  await ensureDir();
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uri = BASE_DIR + safeName;
  await FileSystem.writeAsStringAsync(uri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
  return uri;
}

export async function listManagedFiles(): Promise<ManagedFile[]> {
  try {
    await ensureDir();
    const result: ManagedFile[] = [];
    for (const dir of [BASE_DIR, LEGACY_BASE_DIR]) {
      let files: string[];
      try {
        files = await FileSystem.readDirectoryAsync(dir);
      } catch {
        continue; // legacy directory was never created
      }
      for (const f of files) {
        const uri = dir + f;
        const info = await FileSystem.getInfoAsync(uri);
        if (info.exists && !info.isDirectory) {
          result.push({
            name: f,
            uri,
            size: (info as any).size || 0,
            modified: info.modificationTime || 0,
            isTemplate: f.toLowerCase().includes('template'),
          });
        }
      }
    }
    // newest first
    result.sort((a, b) => b.modified - a.modified);
    return result;
  } catch (e) {
    console.warn('listManagedFiles failed', e);
    return [];
  }
}

export async function deleteManagedFile(uri: string): Promise<void> {
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

export async function shareManagedFile(uri: string): Promise<void> {
  if (Platform.OS === 'web') {
    // web: trigger download
    return;
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { dialogTitle: 'Share Inventory File' });
  } else {
    throw new Error('Sharing not available');
  }
}

export async function getFileBase64(uri: string): Promise<string> {
  return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

// Helper to convert ArrayBuffer to base64
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const uint8 = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
  if (typeof global.btoa === 'function') {
    return global.btoa(binary);
  }
  // fallback
  return Buffer.from(binary, 'binary').toString('base64');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
