import { InventoryItem } from '../domain/inventory';
import { encryptJson, decryptJson } from './crypto';
import { KioskRegistration } from './session';
import { CloudEnvelope, createEnvelope, getEnvelope, putEnvelope } from './jsonblob';

export type NotebookPayload = {
  items: InventoryItem[];
};

export async function openNewNotebook(reg: { hospitalCode: string; sitePin: string }): Promise<string> {
  const sealed = await encryptJson({ items: [] } satisfies NotebookPayload, reg.hospitalCode, reg.sitePin);
  const env: CloudEnvelope = {
    v: 1,
    hospitalCode: reg.hospitalCode,
    rev: 1,
    updatedAt: new Date().toISOString(),
    iv: sealed.iv,
    ct: sealed.ct,
  };
  return createEnvelope(env);
}

export async function pullNotebook(reg: KioskRegistration): Promise<InventoryItem[]> {
  const env = await getEnvelope(reg.blobId);
  if (!env) return [];
  const payload = await decryptJson<NotebookPayload>({ iv: env.iv, ct: env.ct }, reg.hospitalCode, reg.sitePin);
  return Array.isArray(payload.items) ? payload.items : [];
}

export async function pushNotebook(reg: KioskRegistration, items: InventoryItem[]): Promise<void> {
  const current = await getEnvelope(reg.blobId);
  const sealed = await encryptJson({ items } satisfies NotebookPayload, reg.hospitalCode, reg.sitePin);
  const env: CloudEnvelope = {
    v: 1,
    hospitalCode: reg.hospitalCode,
    rev: (current?.rev || 0) + 1,
    updatedAt: new Date().toISOString(),
    iv: sealed.iv,
    ct: sealed.ct,
  };
  if (reg.blobId) await putEnvelope(reg.blobId, env);
}

export async function joinNotebook(blobId: string, hospitalCode: string, sitePin: string): Promise<InventoryItem[]> {
  const env = await getEnvelope(blobId);
  if (!env) throw new Error('No hospital notebook at that link');
  try {
    const payload = await decryptJson<NotebookPayload>({ iv: env.iv, ct: env.ct }, hospitalCode, sitePin);
    return Array.isArray(payload.items) ? payload.items : [];
  } catch {
    throw new Error('Wrong site PIN for this hospital notebook');
  }
}
