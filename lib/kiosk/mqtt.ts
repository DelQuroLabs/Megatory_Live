/** Tiny MQTT 3.1.1 client over WebSocket. Public brokers hold the retained hospital notebook. */

export const MQTT_BROKERS: { url: string; protocols?: string[] }[] = [
  { url: 'wss://broker.emqx.io:8084/mqtt', protocols: ['mqtt'] },
  { url: 'wss://broker.hivemq.com:8884/mqtt', protocols: ['mqtt'] },
  { url: 'wss://test.mosquitto.org:8081' },
];

const enc = () => new TextEncoder();
const dec = () => new TextDecoder();

export function encodeRemainingLength(n: number): number[] {
  const bytes: number[] = [];
  do {
    let encoded = n % 128;
    n = Math.floor(n / 128);
    if (n > 0) encoded |= 0x80;
    bytes.push(encoded);
  } while (n > 0);
  return bytes;
}

export function decodeRemainingLength(buf: Uint8Array, start: number): { len: number; size: number } {
  let multiplier = 1;
  let len = 0;
  let size = 0;
  for (let i = 0; i < 4; i++) {
    const byte = buf[start + i];
    if (byte === undefined) return { len: -1, size: 0 };
    size++;
    len += (byte & 127) * multiplier;
    if ((byte & 128) === 0) return { len, size };
    multiplier *= 128;
  }
  throw new Error('Bad MQTT remaining length');
}

function mqttString(s: string): Uint8Array {
  const body = enc().encode(s);
  const out = new Uint8Array(2 + body.length);
  out[0] = (body.length >> 8) & 0xff;
  out[1] = body.length & 0xff;
  out.set(body, 2);
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function packet(typeFlags: number, variable: Uint8Array): Uint8Array {
  return concat([new Uint8Array([typeFlags, ...encodeRemainingLength(variable.length)]), variable]);
}

export function encodeConnect(clientId: string): Uint8Array {
  const variable = concat([
    mqttString('MQTT'),
    new Uint8Array([4, 0x02, 0, 60]),
    mqttString(clientId),
  ]);
  return packet(0x10, variable);
}

export function encodeSubscribe(packetId: number, topic: string): Uint8Array {
  const id = new Uint8Array([(packetId >> 8) & 0xff, packetId & 0xff]);
  const variable = concat([id, mqttString(topic), new Uint8Array([0])]);
  return packet(0x82, variable);
}

export function encodePublish(topic: string, payload: string, packetId: number): Uint8Array {
  const body = enc().encode(payload);
  const variable = concat([
    mqttString(topic),
    new Uint8Array([(packetId >> 8) & 0xff, packetId & 0xff]),
    body,
  ]);
  // PUBLISH, QoS 1, RETAIN
  return packet(0x33, variable);
}

export type MqttPacket =
  | { type: 'connack'; ok: boolean }
  | { type: 'puback' }
  | { type: 'suback' }
  | { type: 'publish'; payload: string }
  | { type: 'other'; typeNibble: number };

export function parsePackets(buf: Uint8Array): { packets: MqttPacket[]; rest: Uint8Array } {
  const packets: MqttPacket[] = [];
  let i = 0;
  while (i < buf.length) {
    const typeNibble = buf[i] >> 4;
    const flags = buf[i] & 0x0f;
    const rem = decodeRemainingLength(buf, i + 1);
    if (rem.len < 0) break;
    const header = 1 + rem.size;
    if (i + header + rem.len > buf.length) break;
    const variable = buf.subarray(i + header, i + header + rem.len);
    i += header + rem.len;
    if (typeNibble === 2) {
      packets.push({ type: 'connack', ok: variable[1] === 0 });
    } else if (typeNibble === 4) {
      packets.push({ type: 'puback' });
    } else if (typeNibble === 9) {
      packets.push({ type: 'suback' });
    } else if (typeNibble === 3) {
      const qos = (flags >> 1) & 0x03;
      const tlen = (variable[0] << 8) | variable[1];
      let skip = 2 + tlen;
      if (qos > 0) skip += 2;
      packets.push({ type: 'publish', payload: dec().decode(variable.subarray(skip)) });
    } else {
      packets.push({ type: 'other', typeNibble });
    }
  }
  return { packets, rest: buf.subarray(i) };
}

function openSocket(url: string, protocols?: string | string[]): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    let ws: WebSocket;
    try {
      ws = protocols ? new WebSocket(url, protocols) : new WebSocket(url);
    } catch (e) {
      reject(e);
      return;
    }
    ws.binaryType = 'arraybuffer';
    const timer = setTimeout(() => {
      try { ws.close(); } catch { /* ignore */ }
      reject(new Error('Notebook host timed out'));
    }, 4000);
    ws.onopen = () => {
      clearTimeout(timer);
      resolve(ws);
    };
    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Could not reach the hospital notebook'));
    };
  });
}

async function openMqtt(url: string, protocols?: string[]): Promise<WebSocket> {
  return openSocket(url, protocols);
}

function send(ws: WebSocket, data: Uint8Array) {
  ws.send(data);
}

function session(ws: WebSocket): {
  next: (timeoutMs: number) => Promise<MqttPacket[]>;
  close: () => void;
} {
  let buffer = new Uint8Array(0);
  let pending: ((packets: MqttPacket[]) => void) | null = null;
  const queue: MqttPacket[] = [];

  ws.onmessage = (ev) => {
    const chunk = ev.data instanceof ArrayBuffer
      ? new Uint8Array(ev.data)
      : enc().encode(String(ev.data));
    const merged = new Uint8Array(buffer.length + chunk.length);
    merged.set(buffer);
    merged.set(chunk, buffer.length);
    const parsed = parsePackets(merged);
    buffer = new Uint8Array(parsed.rest);
    if (parsed.packets.length) {
      if (pending) {
        const fn = pending;
        pending = null;
        fn(parsed.packets);
      } else {
        queue.push(...parsed.packets);
      }
    }
  };

  return {
    next(timeoutMs) {
      if (queue.length) return Promise.resolve(queue.splice(0, queue.length));
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => {
          pending = null;
          resolve([]);
        }, timeoutMs);
        pending = (packets) => {
          clearTimeout(t);
          resolve(packets);
        };
        ws.onerror = () => {
          clearTimeout(t);
          reject(new Error('Could not reach the hospital notebook'));
        };
      });
    },
    close() {
      try { ws.close(); } catch { /* ignore */ }
    },
  };
}

async function handshake(url: string, protocols?: string[]): Promise<{ ws: WebSocket; io: ReturnType<typeof session> }> {
  const ws = await openMqtt(url, protocols);
  const io = session(ws);
  send(ws, encodeConnect(`mg${Math.random().toString(36).slice(2, 10)}`));
  const packets = await io.next(5000);
  const ack = packets.find(p => p.type === 'connack');
  if (!ack || ack.type !== 'connack' || !ack.ok) {
    io.close();
    throw new Error('Hospital notebook host refused the connection');
  }
  return { ws, io };
}

async function withAnyBroker<T>(fn: (ws: WebSocket, io: ReturnType<typeof session>) => Promise<T>): Promise<T> {
  let last: Error | null = null;
  for (const broker of MQTT_BROKERS) {
    try {
      const { ws, io } = await handshake(broker.url, broker.protocols);
      try {
        return await fn(ws, io);
      } finally {
        io.close();
      }
    } catch (e) {
      last = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw last || new Error('Could not reach the hospital notebook');
}

export async function mqttGet(topic: string): Promise<string | null> {
  return withAnyBroker(async (ws, io) => {
    send(ws, encodeSubscribe(1, topic));
    const start = Date.now();
    while (Date.now() - start < 3500) {
      const packets = await io.next(Math.max(200, 3500 - (Date.now() - start)));
      for (const p of packets) {
        if (p.type === 'publish') return p.payload;
      }
    }
    return null;
  });
}

export async function mqttPut(topic: string, payload: string): Promise<void> {
  await withAnyBroker(async (ws, io) => {
    send(ws, encodePublish(topic, payload, 7));
    const start = Date.now();
    while (Date.now() - start < 4000) {
      const packets = await io.next(Math.max(200, 4000 - (Date.now() - start)));
      if (packets.some(p => p.type === 'puback')) return;
    }
    // QoS0-ish brokers may swallow PUBACK; the retain was still sent.
  });
}
