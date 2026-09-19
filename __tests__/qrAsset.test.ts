import fs from 'fs';
import path from 'path';
import { APP_QR_SRC } from '../lib/share/qr';

describe('live QR asset', () => {
  test('public PNG exists for the Files tab square', () => {
    expect(APP_QR_SRC).toBe('/app-qr.png');
    const file = path.join(__dirname, '..', 'public', 'app-qr.png');
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.statSync(file).size).toBeGreaterThan(500);
    const header = fs.readFileSync(file).subarray(0, 8);
    expect(Array.from(header)).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });
});
