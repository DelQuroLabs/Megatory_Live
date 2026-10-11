/** Client for the self-hosted notebook sync (server/sync.mjs on Coolify). */
import { backendUrl } from '../backend/config';
import type { CloudEnvelope } from './cloud';

export class SyncError extends Error {
  constructor(message: string, readonly status?: number, readonly rev?: number) {
    super(message);
    this.name = 'SyncError';
  }
}

async function call<T>(path: string, init: RequestInit & { key?: string }, timeoutMs = 8000): Promise<T> {
  const controller = typeof AbortController === 'function' ? new AbortController() : undefined;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
  const { key, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(backendUrl(path), {
      ...rest,
      ...(controller ? { signal: controller.signal } : {}),
      headers: {
        Accept: 'application/json',
        ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
        ...(key ? { 'X-Notebook-Key': key } : {}),
      },
    });
  } catch {
    throw new SyncError('Could not reach the hospital notebook');
  } finally {
    if (timer) clearTimeout(timer);
  }
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  if (!res.ok) throw new SyncError(body?.message || `Notebook request failed (${res.status})`, res.status, body?.rev);
  return body as T;
}

/** New notebook on the server; returns its id and the random secret that goes in the invite link. */
export function createNotebook(envelope: CloudEnvelope): Promise<{ id: string; key: string; rev: number }> {
  return call('notebooks', { method: 'POST', body: JSON.stringify({ envelope }) });
}

/** The stored envelope, or null when the id/secret pair doesn't open a notebook. */
export async function getNotebook(id: string, key: string): Promise<CloudEnvelope | null> {
  try {
    const r = await call<{ envelope: CloudEnvelope }>(`notebooks/${encodeURIComponent(id)}`, { method: 'GET', key });
    return r.envelope;
  } catch (e) {
    if (e instanceof SyncError && e.status === 404) return null;
    throw e;
  }
}

/** Save the next revision. A 409 means another clock saved first. */
export function putNotebook(id: string, key: string, envelope: CloudEnvelope): Promise<{ rev: number }> {
  return call(`notebooks/${encodeURIComponent(id)}`, { method: 'PUT', key, body: JSON.stringify({ envelope }) });
}
