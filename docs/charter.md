# Charter — Megatory Live (veterinary inventory)

## Problem and primary user
Veterinary general practice needs to conduct regular inventory counts of medications. Current process uses a locked Excel template where only count columns are editable. Staff need a mobile solution to scan bottles, auto-fill drug details, enter quantities on hand, and compile counts from multiple phones into a final export that matches the exact template placement.

Primary user: Veterinary technician / practice manager conducting inventory in pharmacy, surgery, and storage areas using personal phone.

## One accepted core outcome
A user can scan a veterinary medication bottle barcode (or enter manually), have drug details auto-populated into the correct template columns, enter quantity on hand that adds to the running count, and export/import/merge Excel files across multiple devices to produce a final compiled inventory file.

## Explicit non-goals
- No controlled substance DEA reporting automation (just tracking)
- No integration with practice management software (Cornerstone, eVetPractice) in v1
- Not a full pharmacy dispensing system
- Megatory does not send email (no SMTP / Gmail login). Files hands the .xlsx to Mail, AirDrop, or PairDrop.
- Do not commit the full priced hospital catalog workbook

**Superseded (2026-09-19, user):** “no cloud backend / counts on-device until Excel merge” — the user now wants kiosk login + one hospital notebook, not per-device counts. Current code uses public MQTT brokers as a stand-in; that is **not** the intended own-server.

## Platforms, stack, quality profile
- Platforms: iOS, Android, web-companion for preview/testing
- Stack: Expo SDK 52, React Native, Expo Router, TypeScript, AsyncStorage for offline, expo-camera for barcode scanning, xlsx (SheetJS) for Excel import/export, expo-file-system + expo-sharing for file handling
- Quality: Offline-first, fast scan, honest errors, accessible hit targets, no secrets in bundle

## Connectivity, data, identity assumptions
- Connectivity: hybrid-sync — counting can continue on this clock if the notebook is unreachable; shared COUNT uses the hospital notebook
- Data: anonymous-remote notebook (PIN-encrypted) plus a local cache. Intended: the project’s own server. Current: retained MQTT on public brokers (emqx / hivemq / test.mosquitto)
- Identity: walk-up kiosk (hospital code + site PIN + counter name). Not Apple/Google accounts. PIN currently stored in AsyncStorage

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
- Risk: Hospital notebook on **public MQTT brokers** — ciphertext only, but topic includes hospital code + 20-hex PIN digest; 4-digit PINs are brute-forceable. User asked for own-server storage.
- Risk: Last-write-wins notebook (no merge on concurrent clocks)
- Risk: Site PIN in AsyncStorage on a shared iPad
- Risk: GitHub Pages `https_enforced` is still false (human setting)
- Dependency: expo-camera permissions on iOS/Android
- Decision: Quantity adds to count by default
- Decision: Export layout is MEGATORY_HOSPITAL CODE 3Q2026 (Instructions / INVENTORY SHEET / CATEGORIES)
- Unresolved: Human compare against the real OneDrive workbook; custom domain DNS; PR #2; native smoke waiver actor

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
