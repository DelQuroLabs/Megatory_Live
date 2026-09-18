import { backendUrl } from './config';

export class BackendError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'BackendError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(backendUrl(path), {
      ...init,
      headers: { Accept: 'application/json', ...(init?.headers || {}) },
    });
  } catch {
    throw new BackendError('Backend is unreachable');
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

/** Contract scaffold; wire these calls after the server API is confirmed. */
export const backendApi = {
  health: () => request<{ status: string }>('health'),
  uploadInventory: (payload: unknown) => request('inventory/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),
  downloadInventory: () => request('inventory'),
};
