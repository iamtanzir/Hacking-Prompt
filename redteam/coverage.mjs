#!/usr/bin/env node
/**
 * Coverage gate: every tool in tools.json must have a case that names it.
 *
 *   node redteam/coverage.mjs
 *
 * tools.json is the canonical list: the 35 numbered entries from the transcript's
 * rundown plus the 7 tools that only appear in the comparison table (IDA Pro,
 * Cobalt Strike, Core Impact, Sliver, Mythic, Scapy, Bettercap). Each entry points
 * at the case that covers it and lists the names the case may use.
 *
 * Exit code 1 if a tool is missing its case, if the case never names the tool, or
 * if a per-tool case exists with no inventory entry. That last check is what stops
 * the inventory and the corpus from drifting apart.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const tools = JSON.parse(fs.readFileSync(path.join(here, 'tools.json'), 'utf8'));
const cases = fs
  .readFileSync(path.join(here, 'cases.jsonl'), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const textOf = new Map(cases.map((testCase) => [testCase.id, JSON.stringify(testCase).toLowerCase()]));
const errors = [];

for (const tool of tools) {
  if (!tool.case) {
    errors.push(`${tool.name}: no case assigned in tools.json`);
    continue;
  }
  const text = textOf.get(tool.case);
  if (!text) {
    errors.push(`${tool.name}: case ${tool.case} does not exist in cases.jsonl`);
    continue;
  }
  const named = tool.aliases.some((alias) => text.includes(String(alias).toLowerCase()));
  if (!named) errors.push(`${tool.name}: case ${tool.case} never names the tool (aliases: ${tool.aliases.join(', ')})`);
}

const perTool = cases.filter((testCase) => testCase.id.startsWith('RT-TOOLP-'));
const inventoryed = new Set(tools.map((tool) => tool.case));
const orphans = perTool.map((testCase) => testCase.id).filter((id) => !inventoryed.has(id));
for (const id of orphans) errors.push(`case ${id} has no entry in tools.json`);

const byStatus = tools.reduce((acc, tool) => ({ ...acc, [tool.status]: (acc[tool.status] || 0) + 1 }), {});
const gated = tools.filter((tool) => tool.licenceGated).length;

for (const error of errors) console.error(`error ${error}`);

console.log(
  `${tools.length} tools inventoried, ${tools.length - errors.filter((e) => !e.startsWith('case ')).length} covered — ` +
    Object.entries(byStatus)
      .map(([status, count]) => `${status}: ${count}`)
      .join(', ')
);
console.log(`${gated} licence-gated, ${tools.length - gated} free or open source; ${perTool.length} per-tool cases, ${orphans.length} orphaned`);

process.exit(errors.length ? 1 : 0);
