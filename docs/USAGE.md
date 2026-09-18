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

```
A SKU | B MANUFACTURER | C MANUFACTURER NUMBER | D ITEM DESCRIPTION | E PACK PRICE | F PACK TYPE | G PACK UNIT | H COUNT TYPE | I COUNT (EDITABLE) | J ITEM PRICE | K VALUE ON HAND | L LOG 1 | M LOG 2 | N LOG 3 | O LOG 4 | P LOG 5
```

- **Locked columns (A-O, Q-S)**: Reference only, auto-filled from scans. In your master, these would be protected.
- **Editable column (I)**: COUNT — this is what you edit in the supplied master. Our export puts the final counts here.
- **Instructions sheet**: Second sheet in export explains workflow.

### 3. Import / Export / Multi-Phone Compile

**Single phone:**
- Count → Export → Excel file → Copy Qty column into your protected master.

**Multiple phones (your requested workflow):**
1. Each person counts their area on their own phone (Pharmacy, Surgery, etc)
2. Each phone: Import/Export → Export Current Inventory → Share file (AirDrop, email, Drive)
3. Collect all .xlsx files on one master phone/laptop
4. On master phone: Import/Export → Import Excel File (choose file 1) → strategy "Add quantities" → Import file 2 → Import file 3... 
   - New items get added
   - Existing items (same barcode) have quantities **summed**
5. Final Export = compiled inventory of all phones
6. Copy final Qty column into protected master template

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
