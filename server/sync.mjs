// Megatory Live notebook sync — self-hosted on Coolify, no dependencies (Node 22.13+ built-ins).
//
// Each hospital notebook is stored as the same end-to-end encrypted envelope the app already makes
// (AES-GCM, key from hospital code + site PIN, derived in the browser), so this server never sees
// inventory. Access needs the notebook id AND its random secret, which travels only in the invite
// link / QR. The server keeps a SHA-256 of the secret, never the secret itself.
//
//   POST /api/notebooks            { envelope }            -> 201 { id, key, rev }
//   GET  /api/notebooks/:id        X-Notebook-Key: <key>   -> 200 { envelope } | 404
//   PUT  /api/notebooks/:id        X-Notebook-Key, { envelope }  (envelope.rev must be stored rev + 1)
//                                                          -> 200 { rev } | 409 { rev } | 404
//   GET  /api/health                                       -> 200 { status: 'ok' }
// Anything else is the web app from WEB_DIR (if set), with an index.html fallback.
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';

const MAX_BODY = Number(process.env.MAX_BODY_BYTES || 2_000_000);
const ID_RE = /^[A-Za-z0-9_-]{16,64}$/;
const KEY_RE = /^[A-Za-z0-9_-]{32,128}$/;
const sha = (s) => createHash('sha256').update(s).digest();

export function openStore(path) {
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS notebooks(
      id TEXT PRIMARY KEY, key_hash BLOB NOT NULL, rev INTEGER NOT NULL,
      envelope TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
  return {
    db,
    create(envelope) {
      const id = randomBytes(12).toString('base64url');
      const key = randomBytes(24).toString('base64url');
      const now = new Date().toISOString();
      db.prepare('INSERT INTO notebooks(id, key_hash, rev, envelope, created_at, updated_at) VALUES(?,?,?,?,?,?)')
        .run(id, sha(key), envelope.rev, JSON.stringify(envelope), now, now);
      return { id, key, rev: envelope.rev };
    },
    /** The row if the key matches, else null (same answer for a wrong key and an unknown id). */
    get(id, key) {
      const row = db.prepare('SELECT key_hash, rev, envelope FROM notebooks WHERE id = ?').get(id);
      const given = sha(key);
      // compare against something even for an unknown id, so timing doesn't reveal which ids exist
      const stored = row ? Buffer.from(row.key_hash) : sha('no-such-notebook');
      const match = timingSafeEqual(stored, given);
      return row && match ? { rev: row.rev, envelope: JSON.parse(row.envelope) } : null;
    },
    /** Only the next revision is accepted, so two clocks can't silently overwrite each other. */
    put(id, envelope) {
      const r = db.prepare('UPDATE notebooks SET rev = ?, envelope = ?, updated_at = ? WHERE id = ? AND rev = ?')
        .run(envelope.rev, JSON.stringify(envelope), new Date().toISOString(), id, envelope.rev - 1);
      return Number(r.changes) === 1;
    },
    close() { db.close(); },
  };
}

/** The encrypted envelope the app produces; anything else is refused. */
function validEnvelope(e) {
  return e && typeof e === 'object' && e.v === 1 && Number.isInteger(e.rev) && e.rev >= 1
    && typeof e.iv === 'string' && typeof e.ct === 'string' && e.iv.length <= 64
    && typeof e.hospitalCode === 'string' && e.hospitalCode.length <= 40
    && typeof e.updatedAt === 'string' && e.updatedAt.length <= 40;
}

/** Simple fixed-window limiter per client address. */
function limiter(perMinute) {
  const hits = new Map();
  return (ip) => {
    const now = Date.now();
    const h = hits.get(ip);
    if (!h || now - h.start > 60_000) { hits.set(ip, { start: now, n: 1 }); if (hits.size > 10_000) hits.clear(); return true; }
    h.n += 1;
    return h.n <= perMinute;
  };
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json' };

export function createSyncServer({ store, webDir = '', allowedOrigins = [], trustProxy = false }) {
  const allowCreate = limiter(10);
  const allowRead = limiter(240);

  const clientIp = (req) => {
    if (trustProxy) {
      // the proxy (Coolify/Traefik) appends the real client last; earlier entries are client-supplied
      const xff = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (xff.length) return xff[xff.length - 1];
    }
    return req.socket.remoteAddress || 'unknown';
  };

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
    res.end(JSON.stringify(body));
  };

  const readJson = (req) => new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(Object.assign(new Error('too big'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null')); } catch { reject(Object.assign(new Error('bad json'), { status: 400 })); } });
    req.on('error', reject);
  });

  async function serveWeb(req, res, path) {
    if (!webDir) return send(res, 404, { message: 'Not found' });
    const safe = normalize(decodeURIComponent(path)).replace(/^([/\\])+/, '');
    if (safe.startsWith('..')) return send(res, 404, { message: 'Not found' });
    for (const candidate of [join(webDir, safe), join(webDir, safe, 'index.html'), join(webDir, safe + '.html'), join(webDir, 'index.html')]) {
      try {
        if ((await stat(candidate)).isFile()) {
          res.writeHead(200, { 'Content-Type': TYPES[extname(candidate)] || 'application/octet-stream' });
          return res.end(await readFile(candidate));
        }
      } catch { /* try the next one */ }
    }
    return send(res, 404, { message: 'Not found' });
  }

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://local');
      const path = url.pathname;
      const origin = req.headers.origin;
      const cors = origin && allowedOrigins.includes(origin)
        ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Allow-Headers': 'Content-Type, X-Notebook-Key', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS' }
        : {};
      if (req.method === 'OPTIONS' && path.startsWith('/api/')) { res.writeHead(204, cors); return res.end(); }
      if (path === '/api/health') return send(res, 200, { status: 'ok' }, cors);
      if (!path.startsWith('/api/')) return serveWeb(req, res, path);

      const ip = clientIp(req);
      if (path === '/api/notebooks' && req.method === 'POST') {
        if (!allowCreate(ip)) return send(res, 429, { message: 'Too many new notebooks; try again in a minute.' }, cors);
        const body = await readJson(req);
        if (!validEnvelope(body?.envelope)) return send(res, 400, { message: 'Not a notebook envelope' }, cors);
        return send(res, 201, store.create(body.envelope), cors);
      }
      const m = /^\/api\/notebooks\/([^/]+)$/.exec(path);
      if (m) {
        if (!allowRead(ip)) return send(res, 429, { message: 'Too many requests; try again in a minute.' }, cors);
        const id = m[1];
        const key = String(req.headers['x-notebook-key'] || '');
        if (!ID_RE.test(id) || !KEY_RE.test(key)) return send(res, 404, { message: 'Notebook not found' }, cors);
        const row = store.get(id, key);
        if (!row) return send(res, 404, { message: 'Notebook not found' }, cors);
        if (req.method === 'GET') return send(res, 200, { envelope: row.envelope }, cors);
        if (req.method === 'PUT') {
          const body = await readJson(req);
          if (!validEnvelope(body?.envelope)) return send(res, 400, { message: 'Not a notebook envelope' }, cors);
          if (!store.put(id, body.envelope)) return send(res, 409, { message: 'Someone saved first; reload and try again.', rev: store.get(id, key)?.rev }, cors);
          return send(res, 200, { rev: body.envelope.rev }, cors);
        }
      }
      return send(res, 404, { message: 'Not found' }, cors);
    } catch (e) {
      const status = e && e.status ? e.status : 500;
      if (status === 500) console.error('[sync]', e);
      return send(res, status, { message: status === 413 ? 'Too large' : status === 400 ? 'Bad request' : 'Server error' });
    }
  });
}
