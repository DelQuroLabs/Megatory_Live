# VetCount — Veterinary Inventory Scanner

Mobile app for veterinary general practice inventory counts.

## Quick Start

```bash
npm install --legacy-peer-deps

npm run web:offline   # web preview (use this in a sandbox with no api.expo.dev access)
npm start             # npx expo start — scan QR with Expo Go (iOS/Android)

npm run typecheck     # tsc --noEmit
npm test              # all suites (domain + components)
npm run test:domain
npm run test:components
npm run build:web     # static export to dist/
node scripts/validate_records.cjs   # validate artifacts/ against schemas/
```

## Features Built

✅ **Scan bottle** → auto-populate drug details (barcode → name, manufacturer, concentration, etc)  
✅ **Manual entry** → for things scanner can't find (compounded, no barcode)  
✅ **Quantity adds to count** → enter qty on hand, it ADDS to running total (not overwrite)  
✅ **Inventory list** → search by drug/barcode/manufacturer, filter by location  
✅ **Excel import/export** → generates file matching locked template (only Qty editable concept)  
✅ **Multi-phone compile** → each phone exports partial, master phone imports all with "Add quantities" → final compiled export  
✅ **Offline-first** → works with no network, local storage  
✅ **Vet domain fidelity** → Forms, Categories, Locations specific to vet practice, Controlled Substance tracking  

## Template Structure

16 columns, exact order:
`SKU | MANUFACTURER | MANUFACTURER NUMBER | ITEM DESCRIPTION | PACK PRICE | PACK TYPE | PACK UNIT | COUNT TYPE | COUNT (editable) | ITEM PRICE | VALUE ON HAND | LOG 1 | LOG 2 | LOG 3 | LOG 4 | LOG 5`

Export includes second sheet "Instructions" explaining locked vs editable.

Sample file: `assets/sample-vet-inventory.xlsx`

## Screens

- `/` — Inventory list with search/filter, FABs for Scan/Add/ImportExport
- `/scan` — Camera barcode scanner (ean13, upc_a, code128, qr)
- `/add` — Manual entry + Add Qty mode (when coming from scan)
- `/import-export` — Device name, Export, Import with merge strategy Add/Replace, Template download, Clear

## Domain Logic

`lib/domain/inventory.ts`:
- `TEMPLATE_COLUMNS` — source of truth for Excel layout
- `itemToTemplateRow` / `templateRowToItem` — tolerant parsing
- `mergeInventories(base, incoming, strategy)` — adds quantities or replaces
- `COMMON_VET_DRUGS` — synthetic formulary for quick suggestions

## Storage

- `AsyncStorage` key `vetcount_inventory_v1`
- `lib/storage/excel.ts` uses `xlsx` (SheetJS) for import/export

## Verification

Last re-run 2026-09-18 against current inputs. See `artifacts/verification.json` for full
provenance (commands, timestamps, input hashes, tool versions) and `artifacts/evidence/`
for the raw logs.

| Gate | Result | Notes |
|---|---|---|
| `INSTALL-001` | passed | 2307-byte package.json, real sha256 recorded |
| `TYPECHECK-001` | passed | `tsc --noEmit`, exit 0 |
| `UNIT-001` | passed | 10 tests, domain + dependency contract |
| `COMPONENT-001` | passed | 12 tests rendering the real `app/index.tsx` in jsdom |
| `A11Y-001` | passed | 6 automated assertions on the web target |
| `SEC-001` | passed | automated secret scan of source + served client bundle |
| `SMOKE-001` (web) | passed | bundle serves HTTP 200, 0 unresolved modules |
| `SMOKE-001` (native) | **blocked** | no device/emulator in sandbox |
| `BUILD-001` (web) | passed | `expo export --platform web`, 6 static routes |
| `BUILD-001` (native) | **blocked** | needs EAS + store accounts |
| `VISUAL-001` | **blocked** | no headless browser in sandbox |
| `E2E-001` | **blocked** | needs a real camera |
| `PERF-001` | passed | measured, web target only |

Two required gates are capability-blocked, so the honest phase label is **`incomplete`**,
not `phase-complete`. A waiver needs a human `approving_actor` — it cannot be self-granted.

### Corrections made 2026-09-18

The previous records over-claimed. Specifically:

- **`COMPONENT-001`** was recorded `passed` with the command `npx jest --no-coverage` and the
  note "Component tests same as unit for preview phase" — no component was ever rendered.
- **`A11Y-001`** claimed "all interactive controls have accessible labels"; `grep` found
  **zero** `accessibility*`/`aria-*` props across all four screens (37 `TouchableOpacity`).
- **`BUILD-001` (web)** was recorded `passed` for `npx expo export --platform web`, which
  actually **failed** — see *Known issue* below.
- **`INSTALL-001`** recorded the `package.json` input sha256 as `e3b0c442…f5855`, which is
  the sha256 of the *empty string*, and listed node 22.5.1 / npm 10.8.2 against an actual
  22.22.3 / 10.9.8.
- **`SMOKE-001`** recorded `expo start --web --port 8081`, which cannot run here (see below).
- **`PERF-001`** claimed "cold start <2s" with `tool: manual` and no measurement. Retracted.

### Known issues

- `expo` commands need `--offline` in a sandbox where `api.expo.dev` is unreachable
  (SSL_ERROR_SYSCALL / HTTP 000). Use `npm run web:offline`.
- **Do not bump `query-string` past v7.** expo-router 4.0.22 does `require("query-string")`
  but does not declare it as a dependency, and nothing else in the tree does. v8+ is
  ESM-only, which breaks the static web export with `o.stringify is not a function`.
  `__tests__/deps.test.ts` fails if this regresses.
- `add.tsx`, `scan.tsx` and `import-export.tsx` still have no accessibility labels (31 of
  the 37 touch controls).
- 26 `npm audit` advisories (13 moderate / 12 high / 1 critical) are **not triaged**.


## Next: Match Your Exact Template

The supplied master image is now reflected 1:1 in `TEMPLATE_COLUMNS`; `COUNT` is the editable count field.

## License

MIT — $0/month cost ceiling
