#!/usr/bin/env node
/**
 * Static preview server for the exported web app.
 *
 * `expo export --platform web` produces one HTML file per route plus a
 * hashed JS bundle. Serving that folder with a plain file server mostly
 * works, but deep links (`/add`) and the hashed asset paths need the same
 * fallback GitHub Pages gives us via 404.html, so local previews match
 * what actually deploys.
 *
 * Usage: node scripts/serve-preview.mjs [dir] [port]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = path.resolve(rootDir, process.argv[2] || 'preview');
const port = Number(process.argv[3] || process.env.PORT || 8081);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

if (!fs.existsSync(dir)) {
  console.error(`No such export directory: ${dir}\nRun: npm run build:web`);
  process.exit(1);
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }

  const candidates = [
    path.join(dir, pathname),
    path.join(dir, `${pathname}.html`),
    path.join(dir, pathname, 'index.html'),
  ];

  let file = candidates.find((c) => c.startsWith(dir) && fs.existsSync(c) && fs.statSync(c).isFile());
  if (!file) file = path.join(dir, 'index.html'); // SPA fallback, mirrors 404.html on Pages

  const body = fs.readFileSync(file);
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  });
  res.end(body);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Serving ${dir} on http://0.0.0.0:${port}`);
});
