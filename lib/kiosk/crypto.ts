/** Site-PIN encryption so the hospital notebook is unreadable without the code. */

const enc = () => new TextEncoder();
const dec = () => new TextDecoder();

function bytesToB64(bytes: ArrayBuffer): string {
  const u8 = new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}

export function normalizeHospital(code: string): string {
  return (code || '').replace(/[^A-Za-z0-9]+/g, '').toUpperCase();
}

export async function deriveNotebookKey(hospitalCode: string, pin: string): Promise<CryptoKey> {
  const hospital = normalizeHospital(hospitalCode);
  const material = await crypto.subtle.importKey('raw', enc().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc().encode(`megatory-live-v1:${hospital}`),
      iterations: 120000,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptJson(data: unknown, hospitalCode: string, pin: string): Promise<{ iv: string; ct: string }> {
  const key = await deriveNotebookKey(hospitalCode, pin);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc().encode(JSON.stringify(data)));
  return { iv: bytesToB64(iv.buffer), ct: bytesToB64(ct) };
}

export async function decryptJson<T>(payload: { iv: string; ct: string }, hospitalCode: string, pin: string): Promise<T> {
  const key = await deriveNotebookKey(hospitalCode, pin);
  const iv = b64ToBytes(payload.iv);
  const ct = b64ToBytes(payload.ct);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ct as BufferSource,
  );
  return JSON.parse(dec().decode(pt)) as T;
}
