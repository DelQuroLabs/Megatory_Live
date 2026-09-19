/**
 * Backend connectivity probe.
 *
 * The app is offline-first, so reaching the server is a *state to display*,
 * never an exception a screen has to catch. These tests pin that contract and
 * the URL-joining rules, which is what stops the client from silently
 * double-slashing paths or reporting a 500 as "unreachable".
 */
describe('backend health probe', () => {
  const originalFetch = (global as any).fetch;

  function loadProbe(baseUrl?: string) {
    jest.resetModules();
    if (baseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = baseUrl;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const api = require('../lib/backend/api');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = require('../lib/backend/config');
    return { checkBackendHealth: api.checkBackendHealth as any, BACKEND_BASE_URL: config.BACKEND_BASE_URL as string };
  }

  function mockFetchOnce(impl: (url: string, init?: any) => Promise<any>) {
    (global as any).fetch = jest.fn(impl);
    return (global as any).fetch as jest.Mock;
  }

  afterEach(() => {
    (global as any).fetch = originalFetch;
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
  });

  test('reports reachable with the server status when /health answers 200', async () => {
    const { checkBackendHealth } = loadProbe('https://megatory-live.delqurolabs.app/api');
    const fetchMock = mockFetchOnce(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: 'ok' }),
    }));

    const result = await checkBackendHealth();

    expect(result.reachable).toBe(true);
    if (result.reachable) {
      expect(result.status).toBe('ok');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    }
    expect(fetchMock.mock.calls[0][0]).toBe('https://megatory-live.delqurolabs.app/api/health');
  });

  test('does not double-slash when the base URL has a trailing slash', async () => {
    const { checkBackendHealth } = loadProbe('https://megatory-live.delqurolabs.app/api/');
    const fetchMock = mockFetchOnce(async () => ({
      ok: true, status: 200, text: async () => '{"status":"ok"}',
    }));

    await checkBackendHealth();

    expect(fetchMock.mock.calls[0][0]).toBe('https://megatory-live.delqurolabs.app/api/health');
  });

  test('reports unreachable (not a crash) when fetch throws', async () => {
    const { checkBackendHealth } = loadProbe('https://megatory-live.delqurolabs.app/api');
    mockFetchOnce(async () => { throw new Error('Network request failed'); });

    const result = await checkBackendHealth();

    expect(result.reachable).toBe(false);
    if (!result.reachable) expect(result.reason).toBe('Backend is unreachable');
  });

  test('surfaces the server message on a 500 instead of calling it unreachable', async () => {
    const { checkBackendHealth } = loadProbe('https://megatory-live.delqurolabs.app/api');
    mockFetchOnce(async () => ({
      ok: false, status: 500, text: async () => '{"message":"db down"}',
    }));

    const result = await checkBackendHealth();

    expect(result.reachable).toBe(false);
    if (!result.reachable) expect(result.reason).toBe('db down');
  });

  test('treats non-JSON error bodies as text rather than throwing', async () => {
    const { checkBackendHealth } = loadProbe('https://megatory-live.delqurolabs.app/api');
    mockFetchOnce(async () => ({
      ok: false, status: 502, text: async () => '<html>Bad Gateway</html>',
    }));

    const result = await checkBackendHealth();

    expect(result.reachable).toBe(false);
    if (!result.reachable) expect(result.reason).toContain('Bad Gateway');
  });

  test('reports a timeout when the server never answers', async () => {
    const { checkBackendHealth } = loadProbe('https://megatory-live.delqurolabs.app/api');
    mockFetchOnce((_url: string, init?: any) =>
      new Promise((_resolve, reject) => {
        if (init?.signal) {
          init.signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      }),
    );

    const result = await checkBackendHealth(10);

    expect(result.reachable).toBe(false);
    if (!result.reachable) expect(result.reason).toContain('did not respond within 10ms');
  });

  test('defaults the base URL to the public production API', () => {
    const { BACKEND_BASE_URL } = loadProbe(undefined);
    expect(BACKEND_BASE_URL).toBe('https://megatory-live.delqurolabs.app/api');
  });
});
