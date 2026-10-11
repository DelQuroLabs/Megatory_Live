// Start the notebook sync server (Coolify runs this; see docs/DEPLOYMENT.md).
//   DATA_DIR        where notebooks.db lives (mount a persistent volume here)   default ./data
//   WEB_DIR         the exported web app to serve alongside the API (optional)
//   ALLOWED_ORIGINS other web origins allowed to call the API, comma-separated (optional)
//   TRUST_PROXY=1   behind Coolify/Traefik: rate-limit by the proxy-added client address
//   PORT            default 8080
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openStore, createSyncServer } from './sync.mjs';

const dataDir = process.env.DATA_DIR || './data';
mkdirSync(dataDir, { recursive: true });
const server = createSyncServer({
  store: openStore(join(dataDir, 'notebooks.db')),
  webDir: process.env.WEB_DIR || '',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  trustProxy: process.env.TRUST_PROXY === '1',
});
const port = Number(process.env.PORT || 8080);
server.listen(port, '0.0.0.0', () => console.log(`[sync] Megatory Live notebook sync on :${port} (data ${dataDir})`));
