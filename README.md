# VetCount — Veterinary Inventory Scanner

Mobile app for veterinary general practice inventory counts.

## Quick Start

```bash
npm install --legacy-peer-deps
npx expo start
# Scan QR with Expo Go (iOS/Android)
# Web preview: npx expo start --web --port 8081
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

19 columns, exact order:
`Item ID | Barcode | Drug Name | Generic Name | Manufacturer | Strength/Concentration | Form | Package Size | Category | Location | Expiration Date | Lot Number | Controlled (Y/N) | Controlled Schedule | Unit | Quantity On Hand (editable) | Counted By | Last Counted | Notes`

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

- `INSTALL-001` passed
- `TYPECHECK-001` passed
- `UNIT-001` 6 tests passed
- `SMOKE-001` web passed (native blocked — no emulator in sandbox)
- `A11Y-001` passed
- `VISUAL-001` passed
- `SEC-001` passed (camera only, no secrets, offline)
- `BUILD-001` web passed, native blocked
- `PERF-001` passed

See `artifacts/verification.json`

## Next: Match Your Exact Template

If your protected master has different headers/order, send it and I'll update `TEMPLATE_COLUMNS` to be 1:1.

## License

MIT — $0/month cost ceiling
