#!/usr/bin/env node
/**
 * Validates the control records in artifacts/ against schemas/.
 *
 * The spec package in uploads/ names `scripts/spec_lint.py` as the canonical
 * validator, but that file is NOT present in this workspace (only the Master
 * .md was uploaded). Per the spec's self-containment note, schema-dependent
 * records must not be validated against an absent schema - so this script uses
 * the certified schemas/*.schema.json files that ARE present, with `format`
 * assertion enabled (the F-06 behaviour spec_lint.py provides).
 *
 * Usage: node scripts/validate_records.cjs [file:schema ...]
 * Exit 0 when every checked record is valid.
 */
const fs = require('fs');
const path = require('path');
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');

const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: true });
addFormats(ajv);

const DEFAULT_TARGETS = [
  ['artifacts/intake.json', 'schemas/intake.schema.json'],
  ['artifacts/requirements.json', 'schemas/requirements.schema.json'],
  ['artifacts/verification.json', 'schemas/verification.schema.json'],
  ['artifacts/security.json', 'schemas/security.schema.json'],
  ['artifacts/capabilities.json', 'schemas/capabilities.schema.json'],
  ['artifacts/memory.json', 'schemas/memory.schema.json'],
];

const root = path.resolve(__dirname, '..');
const pairs = process.argv.slice(2).length
  ? process.argv.slice(2).map(a => a.split(':'))
  : DEFAULT_TARGETS;

let invalid = 0;
let checked = 0;

for (const [docRel, schRel] of pairs) {
  const docPath = path.join(root, docRel);
  const schPath = path.join(root, schRel);

  if (!fs.existsSync(schPath)) {
    console.log(`BLOCKED  ${docRel} — schema ${schRel} is absent; refusing to validate against a missing schema`);
    invalid++;
    continue;
  }
  if (!fs.existsSync(docPath)) {
    console.log(`SKIP     ${docRel} — record absent`);
    continue;
  }

  const schema = JSON.parse(fs.readFileSync(schPath, 'utf8'));
  const data = JSON.parse(fs.readFileSync(docPath, 'utf8'));
  const validate = ajv.compile(schema);
  const ok = validate(data);
  checked++;
  console.log(`${ok ? 'VALID   ' : 'INVALID '} ${docRel}  <-  ${schRel}`);
  if (!ok) {
    invalid++;
    for (const e of validate.errors) {
      console.log(`           at ${e.instancePath || '(root)'}: ${e.message}`);
    }
  }
}

console.log(`\n${checked - invalid}/${checked} records valid`);
process.exit(invalid ? 1 : 0);
