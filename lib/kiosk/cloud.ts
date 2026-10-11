import { MQTT_BROKERS, mqttGet, mqttPutTo } from './mqtt';

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

/**
 * Legacy only. Notebooks used to live as retained messages on public MQTT test brokers.
 * They are read once to move them to the self-hosted sync, then wiped.
 */
export function legacyNotebookTopic(id: string): string {
  return `megatory/live/${id}`;
}

export async function getLegacyEnvelope(legacyId: string): Promise<CloudEnvelope | null> {
  if (!legacyId || isLocalNotebook(legacyId)) return null;
  const raw = await mqttGet(legacyNotebookTopic(legacyId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CloudEnvelope;
  } catch {
    return null;
  }
}

/** An empty retained message deletes the retained copy; do it on every broker it may be on. */
export async function wipeLegacyEnvelope(legacyId: string): Promise<void> {
  if (!legacyId || isLocalNotebook(legacyId)) return;
  await Promise.allSettled(MQTT_BROKERS.map((b) => mqttPutTo(b, legacyNotebookTopic(legacyId), '')));
}

export function notebookError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e || '');
  if (/Failed to fetch|NetworkError|timed out|WebSocket|not reach|refused|did not respond/i.test(m)) {
    return 'Could not reach the hospital notebook. Check Wi‑Fi and try again, or continue on this clock only.';
  }
  return m || 'Could not reach the hospital notebook';
}
