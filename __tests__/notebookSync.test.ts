/**
 * Notebook sync on the self-hosted mockServer: moving old MQTT notebooks, joining, saving.
 */
import { encryptJson } from '../lib/kiosk/crypto';
import { kioskUrl, parseKioskQuery } from '../lib/kiosk/url';
import type { CloudEnvelope } from '../lib/kiosk/cloud';
import type { InventoryItem } from '../lib/domain/inventory';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockServer = new Map<string, { key: string; env: CloudEnvelope }>();
let mockNextId = 0;
const mockConflicts = { n: 0 };
jest.mock('../lib/kiosk/syncApi', () => {
  class SyncError extends Error { status?: number; constructor(m: string, s?: number) { super(m); this.status = s; } }
  return {
    SyncError,
    createNotebook: jest.fn(async (env: CloudEnvelope) => {
      const id = `nb-${++mockNextId}-xxxxxxxxxx`;
      mockServer.set(id, { key: `key-${mockNextId}`, env });
      return { id, key: `key-${mockNextId}`, rev: env.rev };
    }),
    getNotebook: jest.fn(async (id: string, key: string) => {
      const row = mockServer.get(id);
      return row && row.key === key ? row.env : null;
    }),
    putNotebook: jest.fn(async (id: string, key: string, env: CloudEnvelope) => {
      const row = mockServer.get(id);
      if (!row || row.key !== key) throw new SyncError('not found', 404);
      if (mockConflicts.n > 0) { mockConflicts.n--; row.env = { ...row.env, rev: row.env.rev + 1 }; throw new SyncError('conflict', 409); }
      if (env.rev !== row.env.rev + 1) throw new SyncError('conflict', 409);
      row.env = env;
      return { rev: env.rev };
    }),
  };
});

const mockLegacy = new Map<string, CloudEnvelope>();
jest.mock('../lib/kiosk/cloud', () => ({
  isLocalNotebook: (id: string) => (id || '').startsWith('local:'),
  notebookError: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  getLegacyEnvelope: jest.fn(async (id: string) => mockLegacy.get(id) ?? null),
  wipeLegacyEnvelope: jest.fn(async (id: string) => { mockLegacy.delete(id); }),
}));

// eslint-disable-next-line import/first
import { createHospitalNotebook, joinHospitalNotebook, makeNotebookId, pullNotebook, pushNotebook, NEEDS_INVITE } from '../lib/kiosk/notebook';
// eslint-disable-next-line import/first
import { createNotebook } from '../lib/kiosk/syncApi';
// eslint-disable-next-line import/first
import { wipeLegacyEnvelope } from '../lib/kiosk/cloud';
// eslint-disable-next-line import/first
import { registerClock, resetKioskMemory, loadRegistration } from '../lib/kiosk/session';

const item = (drugName: string) => ({ id: drugName, drugName }) as unknown as InventoryItem;
async function legacyEnvelope(items: unknown[], hospital = 'OAKVW', pin = '1234'): Promise<CloudEnvelope> {
  const sealed = await encryptJson({ items }, hospital, pin);
  return { v: 1, hospitalCode: hospital, rev: 7, updatedAt: '2026-09-01T00:00:00Z', iv: sealed.iv, ct: sealed.ct };
}

beforeEach(() => {
  mockServer.clear(); mockLegacy.clear(); mockConflicts.n = 0; mockNextId = 0; jest.clearAllMocks(); resetKioskMemory();
});

test('the invite link carries the notebook secret, never the PIN', () => {
  const url = kioskUrl('https://megatory-live.delqurolabs.app', { hospitalCode: 'OAKVW', blobId: 'nb-1', syncKey: 's3cret' });
  expect(url).toBe('https://megatory-live.delqurolabs.app/?ns=OAKVW&nb=nb-1&k=s3cret');
  expect(parseKioskQuery(url.split('?')[1])).toEqual({ hospitalCode: 'OAKVW', blobId: 'nb-1', syncKey: 's3cret' });
});

test('a first clock moves the old public notebook to the sync mockServer, then wipes the public copy', async () => {
  const legacyId = await makeNotebookId('OAKVW', '1234');
  mockLegacy.set(legacyId, await legacyEnvelope([item('Ketamine')]));
  const created = await createHospitalNotebook({ hospitalCode: 'oakvw', sitePin: '1234' });
  expect(created.items.map((i) => i.drugName)).toEqual(['Ketamine']);
  expect(created.syncKey).toBe('key-1');
  expect((createNotebook as jest.Mock).mock.calls[0][0].rev).toBe(1);
  expect(wipeLegacyEnvelope).toHaveBeenCalledWith(legacyId);
  expect(mockLegacy.has(legacyId)).toBe(false);
});

test('with nothing to move, a first clock starts an empty notebook', async () => {
  const created = await createHospitalNotebook({ hospitalCode: 'OAKVW', sitePin: '1234' });
  expect(created.items).toEqual([]);
  expect(wipeLegacyEnvelope).not.toHaveBeenCalled();
});

test('joining needs the right secret and the right PIN', async () => {
  const created = await createHospitalNotebook({ hospitalCode: 'OAKVW', sitePin: '1234' });
  await expect(joinHospitalNotebook({ blobId: created.blobId, syncKey: created.syncKey, hospitalCode: 'OAKVW', sitePin: '1234' })).resolves.toEqual([]);
  await expect(joinHospitalNotebook({ blobId: created.blobId, syncKey: 'wrong', hospitalCode: 'OAKVW', sitePin: '1234' })).rejects.toThrow(/does not open a notebook/);
  await expect(joinHospitalNotebook({ blobId: created.blobId, syncKey: created.syncKey, hospitalCode: 'OAKVW', sitePin: '9999' })).rejects.toThrow(/Wrong site PIN/);
});

test('an old clock moves its notebook on first sync and keeps the new secret', async () => {
  const legacyId = await makeNotebookId('OAKVW', '1234');
  mockLegacy.set(legacyId, await legacyEnvelope([item('Buprenorphine')]));
  const reg = await registerClock({ hospitalCode: 'OAKVW', clockName: 'Old iPad', sitePin: '1234', blobId: legacyId });
  expect((await pullNotebook(reg)).map((i) => i.drugName)).toEqual(['Buprenorphine']);
  const after = await loadRegistration();
  expect(after?.syncKey).toBe('key-1');
  expect(after?.blobId).toBe('nb-1-xxxxxxxxxx');
});

test('a second old clock never creates a separate notebook: it asks for the new QR', async () => {
  const legacyId = await makeNotebookId('OAKVW', '1234'); // already moved and wiped by the first clock
  const reg = await registerClock({ hospitalCode: 'OAKVW', clockName: 'Second iPad', sitePin: '1234', blobId: legacyId });
  await expect(pullNotebook(reg)).rejects.toThrow(NEEDS_INVITE);
  await expect(pushNotebook(reg, [item('Lidocaine')])).rejects.toThrow(NEEDS_INVITE);
  expect(createNotebook).not.toHaveBeenCalled();
});

test('a save that races another clock retries once on the new revision', async () => {
  const created = await createHospitalNotebook({ hospitalCode: 'OAKVW', sitePin: '1234' });
  const reg = await registerClock({ hospitalCode: 'OAKVW', clockName: 'iPad', sitePin: '1234', blobId: created.blobId, syncKey: created.syncKey });
  mockConflicts.n = 1;
  await pushNotebook(reg, [item('Saline')]);
  expect((await pullNotebook(reg)).map((i) => i.drugName)).toEqual(['Saline']);
});
