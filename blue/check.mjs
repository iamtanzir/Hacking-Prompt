#!/usr/bin/env node
/**
 * Blue-team coverage gate.
 *
 *   node blue/check.mjs
 *
 * Fails when a tool has no control, a control names an unknown case or a
 * different tool, detect/harden/mitre are empty, or an ATT&CK id is malformed.
 * The rule lives in controls-lib.mjs so it can be unit tested.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkControls } from './controls-lib.mjs';

/** @type {string} */
const here = path.dirname(fileURLToPath(import.meta.url));
/** @type {string} */
const root = path.join(here, '..');

/** @type {{name: string, case: string, status?: string, licenceGated?: boolean, aliases?: string[]}[]} */
const tools = JSON.parse(fs.readFileSync(path.join(root, 'redteam', 'tools.json'), 'utf8'));
const controls = JSON.parse(fs.readFileSync(path.join(here, 'controls.json'), 'utf8'));

const { errors, stats } = checkControls(tools, controls);

for (const error of errors) console.error(`error ${error}`);

console.log(
  `${stats.tools} tools, ${stats.controls} controls, ${stats.signals} detection signals, ` +
    `${stats.techniques} ATT&CK techniques, ${stats.gated} licence-gated`
);
console.log(errors.length ? `${errors.length} error(s)` : 'paired with the inventory');

process.exit(errors.length ? 1 : 0);
