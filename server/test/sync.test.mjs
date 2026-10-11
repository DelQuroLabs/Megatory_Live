// Notebook sync server: secret-gated access, revision checks, input limits. Run: npm run test:server
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore, createSyncServer } from '../sync.mjs';

const dir = mkdtempSync(join(tmpdir(), 'mg-sync-'));
let store, server, base;
const env = (rev, ct = 'ciphertext') => ({ v: 1, hospitalCode: 'OAKVW', rev, updatedAt: new Date().toISOString(), iv: 'aXY=', ct });

before(async () => {
  store = openStore(join(dir, 'n.db'));
  server = createSyncServer({ store, allowedOrigins: ['https://megatory-live.delqurolabs.app'] });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise((r) => server.close(r)); store.close(); rmSync(dir, { recursive: true, force: true }); });

const call = (path, { method = 'GET', key, body, origin } = {}) => fetch(base + path, {
  method,
  headers: { ...(key ? { 'X-Notebook-Key': key } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(origin ? { Origin: origin } : {}) },
  body: body ? JSON.stringify(body) : undefined,
});

test('creating a notebook returns a random id and secret; the secret is stored only as a hash', async () => {
  const r = await call('/api/notebooks', { method: 'POST', body: { envelope: env(1) } });
  assert.equal(r.status, 201);
  const { id, key, rev } = await r.json();
  assert.match(id, /^[A-Za-z0-9_-]{16}$/);
  assert.match(key, /^[A-Za-z0-9_-]{32}$/);
  assert.equal(rev, 1);
  const row = store.db.prepare('SELECT * FROM notebooks WHERE id = ?').get(id);
  assert.equal(JSON.stringify(row).includes(key), false);
});

test('reading needs the id AND the secret; a wrong secret looks the same as no notebook', async () => {
  const { id, key } = await (await call('/api/notebooks', { method: 'POST', body: { envelope: env(1, 'secret-stuff') } })).json();
  const ok = await call(`/api/notebooks/${id}`, { key });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).envelope.ct, 'secret-stuff');
  assert.equal((await call(`/api/notebooks/${id}`)).status, 404);
  assert.equal((await call(`/api/notebooks/${id}`, { key: 'x'.repeat(32) })).status, 404);
  assert.equal((await call(`/api/notebooks/${'y'.repeat(16)}`, { key })).status, 404);
});

test('saves must be the next revision, so two clocks cannot silently overwrite each other', async () => {
  const { id, key } = await (await call('/api/notebooks', { method: 'POST', body: { envelope: env(1) } })).json();
  assert.equal((await call(`/api/notebooks/${id}`, { method: 'PUT', key, body: { envelope: env(2, 'a') } })).status, 200);
  const stale = await call(`/api/notebooks/${id}`, { method: 'PUT', key, body: { envelope: env(2, 'b') } });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).rev, 2);
  assert.equal((await (await call(`/api/notebooks/${id}`, { key })).json()).envelope.ct, 'a');
  assert.equal((await call(`/api/notebooks/${id}`, { method: 'PUT', key: 'z'.repeat(32), body: { envelope: env(3) } })).status, 404);
});

test('only real envelopes are accepted, and oversized bodies are refused', async () => {
  assert.equal((await call('/api/notebooks', { method: 'POST', body: { envelope: { hello: 'world' } } })).status, 400);
  assert.equal((await call('/api/notebooks', { method: 'POST', body: { envelope: { ...env(1), v: 2 } } })).status, 400);
  const huge = await call('/api/notebooks', { method: 'POST', body: { envelope: env(1, 'x'.repeat(2_100_000)) } }).catch(() => ({ status: 413 }));
  assert.equal(huge.status, 413);
});

test('CORS only for the listed web origin; health is open', async () => {
  const listed = await call('/api/health', { origin: 'https://megatory-live.delqurolabs.app' });
  assert.equal(listed.headers.get('access-control-allow-origin'), 'https://megatory-live.delqurolabs.app');
  const other = await call('/api/health', { origin: 'https://evil.example' });
  assert.equal(other.headers.get('access-control-allow-origin'), null);
  assert.equal((await listed.json()).status, 'ok');
});

test('creating notebooks is rate-limited per address', async () => {
  let limited = false;
  for (let i = 0; i < 12 && !limited; i++) {
    limited = (await call('/api/notebooks', { method: 'POST', body: { envelope: env(1) } })).status === 429;
  }
  assert.equal(limited, true);
});
