#!/usr/bin/env node
/**
 * Coverage gate: every tool in tools.json must have a case that names it.
 *
 *   node redteam/coverage.mjs
 *
 * tools.json is the canonical list: the 35 numbered entries from the transcript's
 * rundown plus the 7 tools that only appear in the comparison table. The rule lives
 * in coverage-lib.mjs so it can be unit tested; this file just loads the data.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCoverage } from './coverage-lib.mjs';

/** @type {string} */
const here = path.dirname(fileURLToPath(import.meta.url));

const tools = JSON.parse(fs.readFileSync(path.join(here, 'tools.json'), 'utf8'));

const cases = fs
  .readFileSync(path.join(here, 'cases.jsonl'), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const { errors, stats } = checkCoverage(tools, cases);

for (const error of errors) console.error(`error ${error}`);

console.log(
  `${stats.tools} tools inventoried, ${stats.covered} covered — ` +
    Object.entries(stats.byStatus)
      .map(([status, count]) => `${status}: ${count}`)
      .join(', ')
);
console.log(
  `${stats.gated} licence-gated, ${stats.tools - stats.gated} free or open source; ` +
    `${stats.perTool} per-tool cases, ${stats.orphans} orphaned`
);

process.exit(errors.length ? 1 : 0);
