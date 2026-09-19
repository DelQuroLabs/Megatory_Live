# VetCount — Veterinary Inventory Scanner — Usage Guide

## What you asked for
- Mobile app to help with inventory that needs to be inputted in a specific place and you don't have edit permission other than the counts
- Scan a bottle of medication, have requested details sent to an Excel file for export to copy template file and need to be able to import
- Enter quantity on hand that will get added to the count
- Use multiple instances to count everything by phone then compile until finished with final product
- Able to enter everything manually too for things it can't find
- Veterinary medicine general practice

## What was built

### 1. Core Flow (works offline)
1. **Scan Bottle**: Open Scan tab, allow camera, align barcode. If barcode exists in your current inventory or previous import, it shows drug details and current qty. Choose "Add Quantity".
2. **Add Qty Mode**: Enter how many bottles/vials/tablets you have. It **adds** to existing count (e.g., you had 2, you add 3 → total 5). This matches your request "added to the count".
3. **Manual Entry**: If scanner can't find it (no barcode, compounded, etc), tap "+ Add" → fill Drug Name, Generic, Manufacturer, Concentration, Form (Tablet/Liquid/Injectable etc), Package Size, Category (Antibiotic, NSAID, Controlled Substance...), Location (Main Pharmacy, Surgery, Refrigerator...), Expiration, Lot, Controlled Y/N + Schedule, Unit, Qty, Counted By, Notes.
4. **Inventory List**: Shows all items, search by name/barcode/manufacturer, filter by location. Tap item to edit. Total counts at top.

### 2. Excel Template — Locked Concept
Your protected master file only allows editing counts. Our app generates Excel with **exact column order** designed to copy/paste:

Three tabs, matching `MEGATORY_HOSPITAL CODE 3Q2026 FINAL.xlsx`:

1. **Instructions**
2. **INVENTORY SHEET** (the one you turn in)
3. **CATEGORIES**

INVENTORY SHEET columns:

```
SVP GL | MANUFACTURER | MANUFACTURER NUMBER | ITEM DESCRIPTION | PACK PRICE | PACK TYPE | PACK UNITS | COUNT TYPE | COUNT (yellow, fractions OK) | ITEM PRICE | VALUE ON HAND | (spacer) | LOG #1 | LOG #2 | LOG #3 | LOG #4 | LOG #5
```

- **COUNT**: the yellow box. Numbers only. `1.75` bottles is OK.
- **COUNT TYPE**: EACH or PACK/BUNDLE.
- **LOG #1**: required for DEA / controlled items (the paper-log balance).
- **Write-ins**: `!!SELECT GL!!` rows at the bottom of INVENTORY SHEET.
- Save as `MEGATORY_<HospitalCode>_3Q2026.xlsx` (Oak View → `MEGATORY_OAKVW`).

### 3. One hospital notebook (kiosk clocks)

Counts do **not** live only on each phone. Think of a shared classroom notebook: every iPad is a clock; the notebook is on the server.

**Register (Dayforce WebClock-style):**
1. First clock: hospital code (namespace), clock name, 4–8 digit site PIN.
2. That clock opens the hospital notebook. Other phones type the **same hospital code and PIN**.
3. Files → Copy link is optional; hospital + PIN is the notebook key.
4. Each person types their name (who is counting), then scans. Lock when they walk away.

The printed app QR still opens the site. Same hospital code + site PIN opens the same notebook. If the notebook host is unreachable, **Continue on this clock only** lets you count locally.

**Excel:**
- Import the hospital `MEGATORY_…3Q2026` file once (it lands in the shared notebook).
- Count on any clock.
- Export when done = `MEGATORY_<HospitalCode>_3Q2026.xlsx`.

**Template import:**
- If you already have a template file with drugs listed but no counts, Import it first, then start scanning/counting — it will populate your app with all drugs, then you just add quantities.

### 4. Device Identity
In Import/Export screen, set Device Name (e.g., "Sarah-Pharmacy", "iPad-Surgery"). This tags who counted what, visible in Counted By column and helps audit merges.

### 5. Veterinary Domain Fidelity
- **Forms**: Tablet, Capsule, Chewable, Liquid, Injectable, Ointment, Cream, Powder, Suspension, Solution, Spot-On, Collar, Other
- **Categories**: Antibiotic, NSAID, Analgesic, Sedative/Anesthesia, Antiparasitic, Vaccine, Fluid, Controlled Substance, Compounded, Supplement, OTC, Other
- **Locations**: Main Pharmacy, Surgery, Exam 1-4, ICU, Lab, Refrigerator, Controlled Cabinet, OTC Shelf, Warehouse, Other
- **Controlled**: Y/N + Schedule II-V tracking

### 6. Web Preview
The app is running now as web companion for quick testing. On real phones, you'd run via Expo Go:
```
npx expo start
Scan QR with Expo Go app
```

Camera scanning works on native iOS/Android. On web, scanning uses camera if browser allows, but best on phone.

### 7. Next Steps to Match Your Exact Template
If your protected master has different column order or names:
1. Send me your template file (or screenshot of headers)
2. TEMPLATE_COLUMNS in lib/domain/inventory.ts matches the supplied master headers exactly
3. Re-export will then be 1:1 copy-paste ready

Currently tolerant parser handles variations (e.g., "Drug" vs "Drug Name", "Qty" vs "Quantity On Hand").

### 8. Files
- `lib/domain/inventory.ts` — domain model, template definition, merge logic
- `lib/storage/excel.ts` — Excel generation/parsing
- `app/index.tsx` — inventory list
- `app/scan.tsx` — barcode scanner
- `app/add.tsx` — manual entry + add-qty mode
- `app/import-export.tsx` — import/export/merge workflow

### 9. Verification
- Typecheck: passed
- Unit tests: 6 passed (merge logic, template parsing, validation)
- Smoke: web preview live on 8081
- Security: no secrets in bundle, camera only, offline-first

Enjoy counting! 🐾
