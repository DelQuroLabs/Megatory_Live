import { InventoryItem } from '../domain/inventory';
import { encryptJson, decryptJson, normalizeHospital } from './crypto';
import { KioskRegistration } from './session';
import { CloudEnvelope, getEnvelope, putEnvelope, isLocalNotebook, notebookError } from './cloud';

export type NotebookPayload = {
  items: InventoryItem[];
};

async function digestPin(hospitalCode: string, pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(`megatory-live-notebook:${normalizeHospital(hospitalCode)}:${pin}`);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, 20);
}

export async function makeNotebookId(hospitalCode: string, pin: string): Promise<string> {
  const hospital = normalizeHospital(hospitalCode);
  return `${hospital}-${await digestPin(hospital, pin)}`;
}

async function seal(items: InventoryItem[], hospitalCode: string, pin: string, rev: number): Promise<CloudEnvelope> {
  const sealed = await encryptJson({ items } satisfies NotebookPayload, hospitalCode, pin);
  return {
    v: 1,
    hospitalCode,
    rev,
    updatedAt: new Date().toISOString(),
    iv: sealed.iv,
    ct: sealed.ct,
  };
}

export async function openHospitalNotebook(input: {
  hospitalCode: string;
  sitePin: string;
}): Promise<{ blobId: string; items: InventoryItem[] }> {
  const hospitalCode = normalizeHospital(input.hospitalCode);
  const blobId = await makeNotebookId(hospitalCode, input.sitePin);
  try {
    const env = await getEnvelope(blobId);
    if (env) {
      try {
        const payload = await decryptJson<NotebookPayload>({ iv: env.iv, ct: env.ct }, hospitalCode, input.sitePin);
        return { blobId, items: Array.isArray(payload.items) ? payload.items : [] };
      } catch {
        throw new Error('Wrong site PIN for this hospital notebook');
      }
    }
    await putEnvelope(blobId, await seal([], hospitalCode, input.sitePin, 1));
    return { blobId, items: [] };
  } catch (e) {
    if (e instanceof Error && /Wrong site PIN/.test(e.message)) throw e;
    throw new Error(notebookError(e));
  }
}

export async function openNewNotebook(reg: { hospitalCode: string; sitePin: string }): Promise<string> {
  const opened = await openHospitalNotebook(reg);
  return opened.blobId;
}

export async function pullNotebook(reg: KioskRegistration): Promise<InventoryItem[]> {
  if (isLocalNotebook(reg.blobId)) return [];
  const env = await getEnvelope(reg.blobId);
  if (!env) return [];
  const payload = await decryptJson<NotebookPayload>({ iv: env.iv, ct: env.ct }, reg.hospitalCode, reg.sitePin);
  return Array.isArray(payload.items) ? payload.items : [];
}

export async function pushNotebook(reg: KioskRegistration, items: InventoryItem[]): Promise<void> {
  if (!reg.blobId || isLocalNotebook(reg.blobId)) return;
  const current = await getEnvelope(reg.blobId);
  await putEnvelope(reg.blobId, await seal(items, reg.hospitalCode, reg.sitePin, (current?.rev || 0) + 1));
}

export async function joinNotebook(blobId: string, hospitalCode: string, sitePin: string): Promise<InventoryItem[]> {
  const opened = await openHospitalNotebook({ hospitalCode, sitePin });
  if (blobId && !isLocalNotebook(blobId) && opened.blobId !== blobId) {
    // Invite id is a hint; hospital+PIN is the real key.
  }
  return opened.items;
}
