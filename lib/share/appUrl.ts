/** Canonical public origin. Runtime prefers the address the user actually opened. */
export const CANONICAL_APP_URL = 'https://megatory-live.delqurolabs.app';

export function currentAppUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin.replace(/\/$/, '');
    if (origin && origin !== 'null' && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      return origin;
    }
  }
  return CANONICAL_APP_URL;
}
