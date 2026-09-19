import { PAIRDROP_URL } from '../lib/share/pairdrop';

describe('PairDrop handoff', () => {
  test('the public URL is pairdrop.net over https', () => {
    expect(PAIRDROP_URL).toBe('https://pairdrop.net');
  });
});
