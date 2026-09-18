# Release Readiness — VetCount Inventory

## Label
phase-complete

## Artifact identity
VetCount Inventory v1.0.0 — Expo app with offline inventory counting, barcode scan, Excel import/export/merge

## Version / Build
1.0.0 (package.json), SDK 52

## Signing custody
Not applicable for preview — local preview only, no store signing

## Permissions / Privacy
- CAMERA permission only, used for barcode scanning
- No personal data collection
- Local-only storage via AsyncStorage
- No analytics

## Dependency / License review
- expo ~52.0.46 MIT
- expo-router MIT
- xlsx Apache-2.0 (SheetJS) — allows commercial use
- @react-native-async-storage MIT
- All deps reviewed, no copyleft conflicts for preview

## Rollback plan
- Local-only, no server: rollback = reinstall previous APK/IPA or clear storage
- Web preview: redeploy previous static export

## Migration compatibility
- Storage version v1 key: vetcount_inventory_v1 — future versions will migrate via versioned keys
- Excel template columns are additive-safe — new columns can be added at end

## Monitoring
- Preview: console logs only
- Production candidate: add Sentry for crash reporting (cost ceiling $0 requires free tier)

## Release notes
- Scan bottle barcode -> auto-populate drug details
- Manual entry fallback for unscannable items
- Quantity adds to count (not overwrite) with add-mode
- Inventory list with search/filter by location
- Excel import/export matching locked template (only Qty editable in master)
- Multi-phone merge: import multiple exports, quantities summed
- Offline-first, no network required

## Post-release owner
Practice manager / dev

## Compensating controls (for blocked gates)
- BUILD-001 native blocked: compensating control = web preview verified + Expo export works; native build requires EAS Build which is unavailable in sandbox. Actor: dev, Date: 2026-09-17
- E2E-001 blocked: compensating control = manual smoke test of full flow (scan -> add qty -> export -> import -> merge -> final export). Actor: dev, Date: 2026-09-17
- advisory_scan blocked: npm audit vulns are dev tooling (glob, tar) not in shipped bundle; manual review shows no critical in production deps. Actor: dev, Date: 2026-09-17
