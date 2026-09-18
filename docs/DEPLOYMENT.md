# VetCount deployment

## GitHub Pages preview

The workflow at `.github/workflows/deploy-web.yml` builds and deploys the Expo web export. Enable **Settings → Pages → GitHub Actions** in the repository. The workflow runs typecheck, all Jest tests, and `expo export` before publishing.

The public backend base URL is configured with the repository variable `VETCOUNT_API_BASE_URL`. If it is not set, the build uses:

`https://megatory-live.delqurolabs.app/api`

This is a public URL only; do not put API keys or private tokens in repository variables used by the browser bundle.

## Existing server

The server must serve the contents of `dist/` over HTTPS and proxy or expose the API under `/api`. Required initial contract for the scaffold is:

- `GET /api/health` → `{ "status": "ok" }`
- `GET /api/inventory` → inventory payload
- `POST /api/inventory/sync` → accepted inventory payload

The client adapter is in `lib/backend/api.ts`; it is intentionally not connected to local inventory persistence until the server's authentication, conflict/merge semantics, and file-upload contract are confirmed.

## Go-live checklist

- Configure DNS for `megatory-live.delqurolabs.app` and install a valid TLS certificate.
- Confirm CORS allows the GitHub Pages origin and the custom server origin.
- Implement authentication before enabling multi-user sync.
- Define Excel upload/download endpoints and maximum file sizes.
- Run the native camera smoke tests separately; GitHub Pages cannot validate native camera behavior.
