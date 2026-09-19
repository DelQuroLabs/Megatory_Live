/** Shared hospital notebook. jsonblob is the public clipboard; payload is PIN-encrypted. */

const BASE = 'https://jsonblob.com/api/jsonBlob';

export type CloudEnvelope = {
  v: 1;
  hospitalCode: string;
  rev: number;
  updatedAt: string;
  iv: string;
  ct: string;
};

async function parseId(res: Response): Promise<string> {
  const header = res.headers.get('x-jsonblob') || res.headers.get('X-jsonblob');
  if (header) return header.trim();
  const loc = res.headers.get('location') || res.headers.get('Location') || res.url;
  const m = String(loc).match(/jsonBlob\/([^/?#]+)/i);
  if (m) return m[1];
  throw new Error('Notebook id missing from cloud');
}

export async function createEnvelope(env: CloudEnvelope): Promise<string> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(env),
  });
  if (!res.ok) throw new Error(`Could not open the hospital notebook (${res.status})`);
  return parseId(res);
}

export async function getEnvelope(id: string): Promise<CloudEnvelope | null> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Could not read the hospital notebook (${res.status})`);
  return res.json();
}

export async function putEnvelope(id: string, env: CloudEnvelope): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(env),
  });
  if (!res.ok) throw new Error(`Could not save the hospital notebook (${res.status})`);
}
