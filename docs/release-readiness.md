# Release Readiness — Megatory Live

## Label
**`incomplete`** — not `phase-complete`.

Corrected 2026-09-19. An earlier revision of this file claimed `phase-complete`.
Four gates cannot be executed in this environment and no signed waivers exist
(`schemas/waivers.schema.json` is defined, but there is no `artifacts/waivers.json`).
Compensating controls below were previously self-granted by "dev"; a waiver
requires a human `approving_actor` and cannot be granted by the agent that was
blocked. Until the manual checks are run and signed, `incomplete` is the honest
label. See `docs/manual-verification.md`.

| Gate | Status | Why |
|---|---|---|
| SMOKE-001 (native) | blocked | no device or emulator |
| E2E-001 | blocked | needs a real camera and barcode |
| BUILD-001 (native) | blocked | needs EAS + store accounts |
| VISUAL-001 | blocked | no headless browser |
| Everything else | passed | see README verification table |

## Artifact identity
Megatory Live v1.0.0 — Expo app with offline inventory counting, barcode scan, Excel import/export/merge

## Version / Build
1.0.0 (package.json), SDK 52

## Signing custody
Not applicable yet — no store build has been produced. Required before BUILD-001 (native) can clear.

## Permissions / Privacy
- CAMERA permission only, used for barcode scanning
- No personal data collection
- Local-only storage via AsyncStorage; no data leaves the device until server sync is confirmed
- No analytics, no telemetry

## Dependency / License review
- expo ~52.0.46 MIT
- expo-router MIT
- @e965/xlsx Apache-2.0 (maintained SheetJS fork; the unmaintained `xlsx` package was removed)
- @react-native-async-storage MIT
- No copyleft conflicts identified

**Open:** `npm audit` reports 27 advisories (15 moderate / 11 high / 1 critical).
All are in the Expo/React Native build toolchain (`@expo/cli`, `@expo/plist`,
`xcode`, `glob`, `tar`); none were found in the shipped client bundle. They are
**not triaged** and remain a production-candidate action item.

## Rollback plan
- Web: redeploy the previous static export from the Pages artifact history
- Native: reinstall the previous build; app data is unchanged by a reinstall
- Storage: the `vetcount_*` → `megatory_live_*` rename is an additive copy — the
  legacy keys are retained, so rolling back to an older build still finds its data

## Migration compatibility
- Storage key `megatory_live_inventory_v1`; legacy `vetcount_inventory_v1` is copied
  forward once on first read (`__tests__/storageMigration.test.ts`)
- Excel template columns are additive-safe — new columns may be appended

## Monitoring
- Preview: console logs only
- Production candidate: add crash reporting on a free tier (the $0/month ceiling rules out paid plans)

## Release notes
- Scan bottle barcode → auto-populate drug details
- Manual entry fallback for unscannable items
- Quantity adds to count (not overwrite) with add-mode
- Inventory list with search/filter by location
- Excel import/export matching the locked template (only COUNT editable in the master)
- Multi-phone merge: import multiple exports, quantities summed
- Offline-first, no network required
- Renamed VetCount → Megatory Live end to end, with storage migration
- Files screen now shows the configured server and can probe `GET /api/health`

## Post-release owner
Practice manager / dev

## Compensating controls (for blocked gates)
None accepted yet. Each blocked gate needs either a completed manual check or a
waiver signed by a named human:

| Gate | Proposed compensating control | Status | Actor | Date |
|---|---|---|---|---|
| BUILD-001 (native) | web export verified; native deferred to first EAS build | **pending** — unsigned | — | — |
| E2E-001 | manual flow in `docs/manual-verification.md` | **pending** — unsigned | — | — |
| SMOKE-001 (native) | manual device boot check | **pending** — unsigned | — | — |
| VISUAL-001 | manual layout pass | **pending** — unsigned | — | — |
| advisory_scan | toolchain-only, absent from shipped bundle | **pending** — untriaged | — | — |
