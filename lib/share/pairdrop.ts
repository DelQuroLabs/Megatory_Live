export const PAIRDROP_URL = 'https://pairdrop.net';

/** Open PairDrop in a new window/tab. Megatory stays put. */
export function openPairDrop(): void {
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    window.open(PAIRDROP_URL, '_blank', 'noopener,noreferrer');
    return;
  }
}
