import { backendUrl } from './config';

const DEFAULT_TIMEOUT_MS = 8000;

export class BackendError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'BackendError';
  }
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = typeof AbortController === 'function' ? new AbortController() : undefined;
  const timer = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : undefined;

  let response: Response;
  try {
    response = await fetch(backendUrl(path), {
      ...init,
      ...(controller ? { signal: controller.signal } : {}),
      headers: { Accept: 'application/json', ...(init?.headers || {}) },
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new BackendError(`Backend did not respond within ${timeoutMs}ms`);
    }
    throw new BackendError('Backend is unreachable');
  } finally {
    if (timer) clearTimeout(timer);
  }

  const body = await response.text();
  let parsed: unknown = null;
  try { parsed = body ? JSON.parse(body) : null; } catch { /* preserve server text below */ }
  if (!response.ok) {
    const message = typeof parsed === 'object' && parsed && 'message' in parsed
      ? String((parsed as { message: unknown }).message)
      : body || `Backend request failed (${response.status})`;
    throw new BackendError(message, response.status);
  }
  return parsed as T;
}

export type BackendHealth =
  | { reachable: true; url: string; status: string; latencyMs: number }
  | { reachable: false; url: string; reason: string };

/**
 * Connectivity probe against the configured server. Never throws — the app is
 * offline-first, so an unreachable backend is a state to display, not an error
 * to propagate.
 */
export async function checkBackendHealth(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<BackendHealth> {
  const url = backendUrl('health');
  const startedAt = Date.now();
  try {
    const result = await request<{ status?: unknown } | null>('health', undefined, timeoutMs);
    const status = result && typeof result === 'object' && 'status' in result
      ? String((result as { status: unknown }).status)
      : 'ok (no status field)';
    return { reachable: true, url, status, latencyMs: Date.now() - startedAt };
  } catch (e) {
    return {
      reachable: false,
      url,
      reason: e instanceof BackendError ? e.message : 'Unknown error',
    };
  }
}

/**
 * Contract scaffold.
 *
 * `checkBackendHealth` is wired to the UI and exercised by tests. These two
 * calls are NOT: the server's authentication, conflict/merge semantics and
 * upload contract are still unconfirmed, so no screen mutates inventory over
 * the network yet. See docs/DEPLOYMENT.md.
 */
export const backendApi = {
  health: () => request<{ status: string }>('health'),
  uploadInventory: (payload: unknown) => request('inventory/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),
  downloadInventory: () => request('inventory'),
};
