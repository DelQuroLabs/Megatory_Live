# Megatory Live — deployment

The app is an offline-first Expo (SDK 52) client. The web target is a **static
export**; there is no server-side rendering and no Node process serving the UI.

## 1. One-time setup (needs a human — a token cannot do this)

**Settings → Pages → Source → "GitHub Actions".**

Until that is set, `.github/workflows/deploy-web.yml` fails at the
**Configure Pages** step and nothing is published. This is the only step the
repository cannot fix for itself; it has failed on every run so far
(`Configure Pages` → failure, `Upload artifact` / `Deploy` → skipped).

## 2. Decide where the domain points — read this before touching DNS

The hostname and the API currently want the *same* name, and that does not work.

Observed on 2026-09-19:

| Host | Resolves to | What that is |
|---|---|---|
| `megatory-live.delqurolabs.app` | `13.140.43.0` (A) | an AWS EC2 address — a server you run, **not** GitHub Pages |
| `delqurolabs.github.io` | `185.199.108–111.153` | the canonical GitHub Pages addresses |

GitHub Pages serves only static files. It cannot answer `POST /api/inventory/sync`.
So if the frontend is published to Pages **on that hostname**, the API must move
to a different name — otherwise `GET /api/health` will hit Pages and 404.

**Pick one of these two:**

**A. Pages for the app, separate host for the API (recommended)**
- DNS: `megatory-live.delqurolabs.app` → `CNAME delqurolabs.github.io`
- API: `api.delqurolabs.app` → your server
- Repo variable `MEGATORY_API_BASE_URL` = `https://api.delqurolabs.app/api`
- `public/CNAME` (already committed) makes Pages accept the custom domain

**B. Serve everything from your own server**
- Skip Pages; keep DNS on `13.140.43.0`
- Serve the contents of the export at `/` and proxy `/api/*` to the backend
- `EXPO_PUBLIC_API_BASE_URL` can stay `https://megatory-live.delqurolabs.app/api`
- The CNAME file and the Pages workflow then do nothing — remove the CNAME if
  you go this route, or Pages will keep trying to claim the hostname

Asset paths in the export are root-absolute (`/_expo/…`), so the app must be
served at a **domain root**, not a sub-path.

## 3. Backend contract — still open

`lib/backend/config.ts` reads `EXPO_PUBLIC_API_BASE_URL`, defaulting to
`https://megatory-live.delqurolabs.app/api`. `lib/backend/api.ts` implements a
health probe with an 8s timeout that is wired to the Files screen and covered by
tests. **Sync is deliberately not wired to any screen**: the request/response
shapes below are a scaffold, not a confirmed contract.

Assumed, unconfirmed:

- `GET /api/health` → `{ "status": "ok" }`
- `GET /api/inventory` → inventory payload
- `POST /api/inventory/sync` → accepted inventory payload

To finish this, the following are needed from whoever runs the server:

1. The real paths and payload shapes (does `/api/inventory` return
   `InventoryItem[]` as stored, or the 16-column template rows?).
2. Authentication: header scheme, and how tokens are issued to a phone.
3. Conflict semantics: last-write-wins, or server-side merge of quantities?
   The client's `mergeInventories` already implements additive merge for
   multi-device compilation; the server should not double-count if it also merges.
4. Upload limits and content type for the Excel sync, if files are sent.
5. CORS: allow the origin the app is served from.

## 4. Go-live checklist

- [ ] **Enable GitHub Pages → Source: GitHub Actions** (blocking; human only)
- [ ] Choose DNS option A or B above and reconcile the existing `13.140.43.0` A record
- [ ] Confirm CORS allows the app's origin
- [ ] Confirm the backend contract in §3, then wire `uploadInventory` / `downloadInventory`
- [ ] Implement authentication before enabling multi-user sync
- [ ] Run the manual checks in `docs/manual-verification.md` (camera, native build, visual)
- [ ] Verify `GET /api/health` from a phone on cellular, not just from this network

## 5. Releasing

Every push to `main` runs typecheck + the full Jest suite + `expo export`, then
publishes. `npm run build:web` writes `dist/`; `npm run preview` serves a local
copy of the same export with the Pages-equivalent fallback behaviour.
