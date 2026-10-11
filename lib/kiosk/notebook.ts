import { InventoryItem } from '../domain/inventory';
import { encryptJson, decryptJson, normalizeHospital } from './crypto';
import { KioskRegistration, updateRegistration } from './session';
import { CloudEnvelope, getLegacyEnvelope, wipeLegacyEnvelope, isLocalNotebook, notebookError } from './cloud';
import { createNotebook, getNotebook, putNotebook, SyncError } from './syncApi';

export type NotebookPayload = {
  items: InventoryItem[];
};

/** Thrown when an old clock's notebook has already moved: it needs the new invite QR. */
export const NEEDS_INVITE = 'This clock needs the new invite QR: scan it on a clock that is already set up.';

async function digestPin(hospitalCode: string, pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(`megatory-live-notebook:${normalizeHospital(hospitalCode)}:${pin}`);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, 20);
}

/** Legacy only: where a notebook lived on the public MQTT brokers (derived from hospital + PIN). */
export async function makeNotebookId(hospitalCode: string, pin: string): Promise<string> {
  const hospital = normalizeHospital(hospitalCode);
  return `${hospital}-${await digestPin(hospital, pin)}`;
}

async function seal(items: InventoryItem[], hospitalCode: string, pin: string, rev: number): Promise<CloudEnvelope> {
  const sealed = await encryptJson({ items } satisfies NotebookPayload, hospitalCode, pin);
  return { v: 1, hospitalCode, rev, updatedAt: new Date().toISOString(), iv: sealed.iv, ct: sealed.ct };
}

async function unseal(env: CloudEnvelope, hospitalCode: string, pin: string): Promise<InventoryItem[]> {
  let payload: NotebookPayload;
  try {
    payload = await decryptJson<NotebookPayload>({ iv: env.iv, ct: env.ct }, hospitalCode, pin);
  } catch {
    throw new Error('Wrong site PIN for this hospital notebook');
  }
  return Array.isArray(payload.items) ? payload.items : [];
}

/** An old MQTT notebook for this hospital + PIN, moved to the sync server and wiped from the public broker. */
async function moveLegacyNotebook(hospitalCode: string, sitePin: string, legacyId: string):
  Promise<{ blobId: string; syncKey: string; items: InventoryItem[] } | null> {
  let legacy: CloudEnvelope | null = null;
  try { legacy = await getLegacyEnvelope(legacyId); } catch { legacy = null; } // brokers down: nothing to move
  if (!legacy) return null;
  const items = await unseal(legacy, hospitalCode, sitePin);
  const created = await createNotebook({ ...legacy, rev: 1, updatedAt: new Date().toISOString() });
  await wipeLegacyEnvelope(legacyId);
  return { blobId: created.id, syncKey: created.key, items };
}

/**
 * First clock of a hospital: a new notebook on the sync server, or the hospital's old MQTT
 * notebook moved over (then wiped) if there is one. Returns the invite secret for other clocks.
 */
export async function createHospitalNotebook(input: { hospitalCode: string; sitePin: string }):
  Promise<{ blobId: string; syncKey: string; items: InventoryItem[] }> {
  const hospitalCode = normalizeHospital(input.hospitalCode);
  try {
    const moved = await moveLegacyNotebook(hospitalCode, input.sitePin, await makeNotebookId(hospitalCode, input.sitePin));
    if (moved) return moved;
    const created = await createNotebook(await seal([], hospitalCode, input.sitePin, 1));
    return { blobId: created.id, syncKey: created.key, items: [] };
  } catch (e) {
    if (e instanceof Error && /Wrong site PIN/.test(e.message)) throw e;
    throw new Error(notebookError(e));
  }
}

/** Another clock joining from the invite link / QR (id + secret), with the site PIN. */
export async function joinHospitalNotebook(input: { blobId: string; syncKey: string; hospitalCode: string; sitePin: string }):
  Promise<InventoryItem[]> {
  const hospitalCode = normalizeHospital(input.hospitalCode);
  let env: CloudEnvelope | null;
  try {
    env = await getNotebook(input.blobId, input.syncKey);
  } catch (e) {
    throw new Error(notebookError(e));
  }
  if (!env) throw new Error('This invite link does not open a notebook. Scan the QR again on a clock that is set up.');
  return unseal(env, hospitalCode, input.sitePin);
}

/**
 * A clock registered before the move has no secret. The first such clock to sync moves the old
 * notebook (and wipes the public copy); any later one finds nothing to move and must scan the new
 * QR — it never creates a second, separate notebook.
 */
async function migrateOldClock(reg: KioskRegistration): Promise<{ reg: KioskRegistration; items: InventoryItem[] }> {
  const moved = await moveLegacyNotebook(reg.hospitalCode, reg.sitePin, reg.blobId);
  if (!moved) throw new Error(NEEDS_INVITE);
  const next = (await updateRegistration({ blobId: moved.blobId, syncKey: moved.syncKey })) ?? { ...reg, blobId: moved.blobId, syncKey: moved.syncKey };
  return { reg: next, items: moved.items };
}

export async function pullNotebook(reg: KioskRegistration): Promise<InventoryItem[]> {
  if (isLocalNotebook(reg.blobId)) return [];
  if (!reg.syncKey) return (await migrateOldClock(reg)).items;
  const env = await getNotebook(reg.blobId, reg.syncKey);
  if (!env) throw new Error(NEEDS_INVITE);
  return unseal(env, reg.hospitalCode, reg.sitePin);
}

export async function pushNotebook(reg: KioskRegistration, items: InventoryItem[]): Promise<void> {
  if (!reg.blobId || isLocalNotebook(reg.blobId)) return;
  const target = reg.syncKey ? reg : (await migrateOldClock(reg)).reg;
  const key = target.syncKey as string;
  // save as the next revision; if another clock saved in between, take the new revision and save once more
  for (let attempt = 0; attempt < 2; attempt++) {
    const current = await getNotebook(target.blobId, key);
    if (!current) throw new Error(NEEDS_INVITE);
    try {
      await putNotebook(target.blobId, key, await seal(items, target.hospitalCode, target.sitePin, current.rev + 1));
      return;
    } catch (e) {
      if (!(e instanceof SyncError && e.status === 409) || attempt === 1) throw e;
    }
  }
}
