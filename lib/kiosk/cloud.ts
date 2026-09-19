import { mqttGet, mqttPut } from './mqtt';

export type CloudEnvelope = {
  v: 1;
  hospitalCode: string;
  rev: number;
  updatedAt: string;
  iv: string;
  ct: string;
};

export function isLocalNotebook(id: string): boolean {
  return (id || '').startsWith('local:');
}

export function notebookTopic(id: string): string {
  return `megatory/live/${id}`;
}

export async function getEnvelope(id: string): Promise<CloudEnvelope | null> {
  if (!id || isLocalNotebook(id)) return null;
  const raw = await mqttGet(notebookTopic(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CloudEnvelope;
  } catch {
    return null;
  }
}

export async function putEnvelope(id: string, env: CloudEnvelope): Promise<void> {
  if (!id || isLocalNotebook(id)) return;
  await mqttPut(notebookTopic(id), JSON.stringify(env));
}

export function notebookError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e || '');
  if (/Failed to fetch|NetworkError|timed out|WebSocket|not reach|refused/i.test(m)) {
    return 'Could not reach the hospital notebook. Check Wi‑Fi and try again, or continue on this clock only.';
  }
  return m || 'Could not reach the hospital notebook';
}
