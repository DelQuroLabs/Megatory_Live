import { normalizeHospital } from './crypto';

/**
 * Invite link / QR for other clocks: hospital code (ns), notebook id (nb) and the notebook's
 * random secret (k). The site PIN is never in the link — it is typed on each clock.
 */
export function kioskUrl(origin: string, reg: { hospitalCode: string; blobId: string; syncKey?: string }): string {
  const u = origin.replace(/\/$/, '');
  const key = reg.syncKey ? `&k=${encodeURIComponent(reg.syncKey)}` : '';
  return `${u}/?ns=${encodeURIComponent(reg.hospitalCode)}&nb=${encodeURIComponent(reg.blobId)}${key}`;
}

export function parseKioskQuery(search: string): { hospitalCode?: string; blobId?: string; syncKey?: string } {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const ns = q.get('ns') || q.get('h') || '';
  const nb = q.get('nb') || '';
  const k = q.get('k') || '';
  return {
    hospitalCode: ns ? normalizeHospital(ns) : undefined,
    blobId: nb || undefined,
    syncKey: k || undefined,
  };
}
