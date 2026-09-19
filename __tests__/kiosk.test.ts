import { decryptJson, encryptJson, normalizeHospital } from '../lib/kiosk/crypto';
import { parseKioskQuery, kioskUrl } from '../lib/kiosk/url';
import { encodeRemainingLength, parsePackets, encodeConnect } from '../lib/kiosk/mqtt';

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

describe('mqtt packets', () => {
  test('remaining length uses the MQTT variable encoding', () => {
    expect(encodeRemainingLength(0)).toEqual([0]);
    expect(encodeRemainingLength(127)).toEqual([127]);
    expect(encodeRemainingLength(128)).toEqual([128, 1]);
  });

  test('a CONNECT packet starts with type 0x10', () => {
    const pkt = encodeConnect('abc');
    expect(pkt[0]).toBe(0x10);
  });

  test('CONNACK success parses', () => {
    const { packets } = parsePackets(Uint8Array.from([0x20, 0x02, 0x00, 0x00]));
    expect(packets).toEqual([{ type: 'connack', ok: true }]);
  });
});

describe('kiosk invite URL', () => {
  test('join link carries hospital code and notebook id', () => {
    const url = kioskUrl('https://megatory-live.delqurolabs.app', { hospitalCode: 'OAKVW', blobId: 'abc123' });
    expect(url).toBe('https://megatory-live.delqurolabs.app/?ns=OAKVW&nb=abc123');
    expect(parseKioskQuery('?ns=OAKVW&nb=abc123')).toEqual({ hospitalCode: 'OAKVW', blobId: 'abc123' });
  });
});
