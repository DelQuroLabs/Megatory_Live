import { normalizeHospital } from './crypto';

export function kioskUrl(origin: string, reg: { hospitalCode: string; blobId: string }): string {
  const u = origin.replace(/\/$/, '');
  return `${u}/?ns=${encodeURIComponent(reg.hospitalCode)}&nb=${encodeURIComponent(reg.blobId)}`;
}

export function parseKioskQuery(search: string): { hospitalCode?: string; blobId?: string } {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const ns = q.get('ns') || q.get('h') || '';
  const nb = q.get('nb') || '';
  return {
    hospitalCode: ns ? normalizeHospital(ns) : undefined,
    blobId: nb || undefined,
  };
}
