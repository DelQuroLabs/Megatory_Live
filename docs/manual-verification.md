# Manual verification checklist

Four gates cannot be executed in this environment. They are recorded as
**blocked**, not passed. This document is the hand-off: run each check, then
record the result here (or paste it into the PR) so the verification record
reflects something that actually happened.

Record as: `gate | result (pass/fail) | who | date | evidence`

---

## GATE: SMOKE-001 (native) — app boots on a real device

Blocked because: no device or emulator is available here.

```bash
npm install --legacy-peer-deps
npx expo start          # scan the QR with Expo Go (iOS) / Expo Go (Android)
```

- [ ] App boots to the Stock tab without a red screen
- [ ] Bottom tab bar shows Stock / Scan / Add / Files
- [ ] Rotating to landscape is refused (portrait is enforced in `app.json`)
- [ ] Airplane mode: app still loads and shows previously counted items

## GATE: E2E-001 — full counting flow with the camera

Blocked because: needs a real camera and a real barcode.

1. **Scan** a medication bottle → barcode populates the drug fields
2. Scan an unknown barcode → falls through to manual entry with the barcode pre-filled
3. **Add qty** → running total increments rather than replacing
4. **Export** → Excel file downloads / saves with the 16 template columns in order
5. **Import** that file with *Add qty* → quantities double (proves additive merge)
6. **Import** with *Replace* → quantities equal the imported file
7. **Clear Local** → list empties, and **stays empty after an app restart**
   (this is the regression the storage migration could cause — see below)

## GATE: BUILD-001 (native) — store build

Blocked because: needs EAS plus Apple/Google accounts.

```bash
npx eas build --platform android --profile preview
npx eas build --platform ios     --profile preview
```

- [ ] Android build succeeds
- [ ] iOS build succeeds
- [ ] Camera permission prompt shows the Megatory Live copy (not "VetCount")

## GATE: VISUAL-001 — layout pass

Blocked because: no headless browser here.

- [ ] Stock list, Scan, Add, and Files screens at 375px and 768px wide
- [ ] Tab bar does not overlap content on a device with a home indicator
- [ ] Text is legible at the OS "large text" accessibility setting

---

## Regression to watch: the storage rename

`AsyncStorage` keys moved from `vetcount_*` to `megatory_live_*`, with a
one-time forward copy. If you have a device that already counted under the old
build, install this build over it and confirm:

- [ ] Previously counted items are still present after upgrade
- [ ] Device name survived the upgrade
- [ ] Clearing the count does not bring old items back on next launch

Covered automatically by `__tests__/storageMigration.test.ts`; this is the
on-device confirmation.
