import { CANONICAL_APP_URL, currentAppUrl } from '../lib/share/appUrl';

describe('share URL', () => {
  test('canonical live origin is the custom domain', () => {
    expect(CANONICAL_APP_URL).toBe('https://megatory-live.delqurolabs.app');
    expect(currentAppUrl()).toBe(CANONICAL_APP_URL);
  });
});
