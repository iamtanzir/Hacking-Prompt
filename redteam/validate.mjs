#!/usr/bin/env node
/**
 * Validate cases.jsonl before it reaches a model.
 *
 *   node redteam/validate.mjs
 *   node redteam/validate.mjs --strict   # unknown fields become errors
 *
 * The rules live in validate-cases.mjs so they can be unit tested; this file only
 * reads the file, prints the result and sets the exit code for CI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCases } from './validate-cases.mjs';

/** @type {string} */
const here = path.dirname(fileURLToPath(import.meta.url));
/** @type {boolean} */
const strict = process.argv.includes('--strict');

const raw = fs
  .readFileSync(path.join(here, 'cases.jsonl'), 'utf8')
  .split('\n')
  .map((line, index) => ({ line, number: index + 1 }))
  .filter((entry) => entry.line.trim() && !entry.line.trim().startsWith('//'));

/** @type {string[]} */
const parseErrors = [];
const cases = [];
for (const entry of raw) {
  try {
    cases.push({ ...JSON.parse(entry.line), __line: entry.number });
  } catch (err) {
    parseErrors.push(`line ${entry.number}: invalid JSON — ${/** @type {Error} */ (err).message}`);
  }
}

const { errors, warnings, stats } = validateCases(cases, { strict });

for (const warning of warnings) console.log(`warn  ${warning}`);
for (const error of [...parseErrors, ...errors]) console.error(`error ${error}`);

console.log(
  `\n${stats.total} cases (${stats.multiTurn} multi-turn) — ` +
    Object.entries(stats.byCategory)
      .map(([category, count]) => `${category}: ${count}`)
      .join(', ')
);

const total = errors.length + parseErrors.length;
console.log(
  total ? `${total} error(s), ${warnings.length} warning(s)` : `valid, ${warnings.length} warning(s)`
);

process.exit(total ? 1 : 0);
