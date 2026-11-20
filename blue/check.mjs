#!/usr/bin/env node
/**
 * Blue-team coverage gate.
 *
 *   node blue/check.mjs
 *
 * Fails when:
 *   - a tool in redteam/tools.json has no control entry,
 *   - a control names a tool that is not in the inventory,
 *   - a control points at a different case than the inventory does,
 *   - detect / harden / mitre are empty, or an ATT&CK id is malformed.
 *
 * Run it wherever the red-team gate runs; the two lists are meant to stay paired.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

const tools = JSON.parse(fs.readFileSync(path.join(root, 'redteam', 'tools.json'), 'utf8'));
const controls = JSON.parse(fs.readFileSync(path.join(here, 'controls.json'), 'utf8'));

const errors = [];
// Keyed by case id, not tool name: the inventory lists Invicti twice (entries 1 and 10),
// so a name-keyed map would silently drop one of them.
const toolByCase = new Map(tools.map((tool) => [tool.case, tool]));
const controlByCase = new Map();

for (const control of controls) {
  if (!control.tool) {
    errors.push('control entry without a tool name');
    continue;
  }
  if (!control.case) {
    errors.push(`${control.tool}: control entry without a case id`);
    continue;
  }
  if (controlByCase.has(control.case)) errors.push(`${control.tool}: duplicate control entry for ${control.case}`);
  controlByCase.set(control.case, control);

  if (!toolByCase.has(control.case)) {
    errors.push(`${control.tool}: case ${control.case} is not in redteam/tools.json`);
    continue;
  }

  const tool = toolByCase.get(control.case);
  if (control.tool !== tool.name) {
    errors.push(`${control.case}: control names ${control.tool}, inventory says ${tool.name}`);
  }
  if (typeof control.licenceGated !== 'boolean') {
    errors.push(`${control.tool}: licenceGated must be a boolean`);
  }
  for (const field of ['detect', 'harden', 'mitre']) {
    if (!Array.isArray(control[field]) || control[field].length === 0) {
      errors.push(`${control.tool}: "${field}" must be a non-empty array`);
    }
  }
  for (const id of control.mitre || []) {
    if (!/^T\d{4}(\.\d{3})?$/.test(String(id))) {
      errors.push(`${control.tool}: "${id}" is not an ATT&CK technique id (T1234 or T1234.001)`);
    }
  }
  if (typeof control.note !== 'string' || !control.note.trim()) {
    errors.push(`${control.tool}: "note" must be a non-empty string`);
  }
}

for (const tool of tools) {
  if (!controlByCase.has(tool.case)) errors.push(`${tool.name}: no blue-team control entry for ${tool.case}`);
}

const detectSignals = controls.reduce((sum, control) => sum + (control.detect?.length || 0), 0);
const techniques = new Set(controls.flatMap((control) => control.mitre || []));

for (const error of errors) console.error(`error ${error}`);

console.log(
  `${tools.length} tools, ${controls.length} controls, ${detectSignals} detection signals, ` +
    `${techniques.size} ATT&CK techniques, ${controls.filter((control) => control.licenceGated).length} licence-gated`
);
console.log(errors.length ? `${errors.length} error(s)` : 'paired with the inventory');

process.exit(errors.length ? 1 : 0);
