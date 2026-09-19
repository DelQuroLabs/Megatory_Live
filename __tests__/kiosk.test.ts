import { decryptJson, encryptJson, normalizeHospital } from '../lib/kiosk/crypto';
import { parseKioskQuery, kioskUrl } from '../lib/kiosk/url';

describe('kiosk crypto', () => {
  test('hospital code is the short name, letters and numbers only', () => {
    expect(normalizeHospital('oak-view')).toBe('OAKVIEW');
    expect(normalizeHospital('OAKVW')).toBe('OAKVW');
  });

  test('the same hospital + PIN can read what it sealed', async () => {
    const sealed = await encryptJson({ items: [{ id: 'a', quantityOnHand: 2 }] }, 'OAKVW', '1234');
    const opened = await decryptJson<{ items: { id: string; quantityOnHand: number }[] }>(sealed, 'OAKVW', '1234');
    expect(opened.items[0].quantityOnHand).toBe(2);
  });

  test('the wrong PIN cannot open the notebook', async () => {
    const sealed = await encryptJson({ items: [] }, 'OAKVW', '1234');
    await expect(decryptJson(sealed, 'OAKVW', '9999')).rejects.toThrow();
  });
});

describe('kiosk invite URL', () => {
  test('join link carries hospital code and notebook id', () => {
    const url = kioskUrl('https://megatory-live.delqurolabs.app', { hospitalCode: 'OAKVW', blobId: 'abc123' });
    expect(url).toBe('https://megatory-live.delqurolabs.app/?ns=OAKVW&nb=abc123');
    expect(parseKioskQuery('?ns=OAKVW&nb=abc123')).toEqual({ hospitalCode: 'OAKVW', blobId: 'abc123' });
  });
});
