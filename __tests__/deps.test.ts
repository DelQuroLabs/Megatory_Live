/**
 * BUILD-001 regression guard.
 *
 * expo-router 4.0.22 does `require("query-string")` but does NOT declare it as a
 * dependency (a phantom dependency satisfied only by hoisting). Nothing else in
 * the tree declares it either, so whatever version this project pins is the one
 * expo-router gets.
 *
 * query-string >= 8 is ESM-only ("type": "module"). When that version is
 * hoisted, expo-router's CommonJS `require()` no longer yields a `.stringify`
 * function and `npx expo export --platform web` dies with:
 *
 *     Metro error: o.stringify is not a function
 *     Error: Failed to statically export route: +not-found
 *
 * It was pinned at ^9.5.1, which broke the web export. It is pinned at ^7.1.3
 * (CommonJS) now. This test fails loudly if it is bumped back to an ESM-only
 * major.
 */
describe('dependency contract', () => {
  test('query-string is CommonJS-requireable and exposes stringify', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const queryString = require('query-string');

    expect(typeof queryString.stringify).toBe('function');
    expect(queryString.stringify({ a: 1, b: 'x y' })).toBe('a=1&b=x%20y');
  });

  test('query-string stays on a CommonJS major (< 8)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('query-string/package.json');
    const major = Number(String(pkg.version).split('.')[0]);

    expect(pkg.type).not.toBe('module');
    expect(major).toBeLessThan(8);
  });
});
