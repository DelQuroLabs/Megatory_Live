# Charter — VetCount Mobile Inventory

## Problem and primary user
Veterinary general practice needs to conduct regular inventory counts of medications. Current process uses a locked Excel template where only count columns are editable. Staff need a mobile solution to scan bottles, auto-fill drug details, enter quantities on hand, and compile counts from multiple phones into a final export that matches the exact template placement.

Primary user: Veterinary technician / practice manager conducting inventory in pharmacy, surgery, and storage areas using personal phone.

## One accepted core outcome
A user can scan a veterinary medication bottle barcode (or enter manually), have drug details auto-populated into the correct template columns, enter quantity on hand that adds to the running count, and export/import/merge Excel files across multiple devices to produce a final compiled inventory file.

## Explicit non-goals
- No cloud backend required for MVP (local-only, offline-first)
- No controlled substance DEA reporting automation (just tracking)
- No integration with practice management software (Cornerstone, eVetPractice) in v1
- No price/cost tracking beyond quantity
- Not a full pharmacy dispensing system

## Platforms, stack, quality profile
- Platforms: iOS, Android, web-companion for preview/testing
- Stack: Expo SDK 52, React Native, Expo Router, TypeScript, AsyncStorage for offline, expo-camera for barcode scanning, xlsx (SheetJS) for Excel import/export, expo-file-system + expo-sharing for file handling
- Quality: Offline-first, fast scan, honest errors, accessible hit targets, no secrets in bundle

## Connectivity, data, identity assumptions
- Connectivity: offline-first — all counting works offline, import/export works with local files
- Data: local-only — inventory stored on device, exported as Excel
- Identity: local-only — no login required, countedBy field is free text per device

## Declared phase
preview — vertical slice that works end-to-end on device and web companion

## Acceptance criteria
- [ ] Scan screen uses camera to read UPC/EAN/NDC barcodes
- [ ] If barcode found in local DB or previous import, auto-populate: Drug Name, Generic, Manufacturer, Concentration, Form, Package Size, Category, Location, Unit
- [ ] If not found, prompt manual entry with barcode pre-filled
- [ ] Quantity on hand entry adds to count (not overwrites) with ability to edit/override
- [ ] Manual entry form for all fields: supports things scanner can't find
- [ ] Inventory list shows all items with current counts, search/filter by name/barcode/location
- [ ] Excel template export: generates file with columns in exact order required (locked concept: only Qty column intended for edit, but file is standard Excel)
- [ ] Excel import: can import template file, parse columns, load into app
- [ ] Multi-phone compile: can import multiple exported files and merge — new items added, existing items quantities summed (configurable: add vs replace)
- [ ] Offline: works with no network
- [ ] Empty/loading/error states honest
- [ ] Final export matches template structure ready to copy/paste into protected master file

## Risks, dependencies, unresolved decisions
- Risk: Barcode lookup for vet drugs has no single free API — will use local DB seeded from common vet formulary + manual entry
- Risk: Excel file handling in React Native needs polyfills
- Dependency: expo-camera permissions on iOS/Android
- Unresolved: Exact column order of user's existing template — will provide configurable mapping and default template based on typical vet practice: Item ID, Barcode, Drug Name, Generic Name, Manufacturer, Strength/Concentration, Form, Package Size, Category, Location, Expiration, Lot, Controlled (Y/N), Unit, Qty On Hand, Counted By, Last Counted, Notes
- Decision: Quantity adds to count by default — user said "that will get added to the count" — implement Add mode with option to Set

## Current completion label
incomplete

## Cost ceiling
$0/month — free tiers only, no paid APIs

## Domain fidelity notes (POL-DOMAIN-026)
Veterinary pharmacy fields modeled from real practice:
- Form enum: Tablet, Capsule, Chewable, Liquid, Injectable, Ointment, Cream, Powder, Suspension, Solution, Spot-On, Collar, Other
- Category enum: Antibiotic, NSAID, Analgesic, Sedative/Anesthesia, Antiparasitic, Vaccine, Fluid, Controlled Substance, Compounded, Supplement, Other
- Location enum: Main Pharmacy, Surgery, Exam Room 1-4, ICU, Lab, Refrigerator, Controlled Cabinet, OTC, Warehouse
- Controlled: Boolean + Schedule (II-V) where applicable
- Unit: bottles, boxes, vials, tablets, mL, etc.
