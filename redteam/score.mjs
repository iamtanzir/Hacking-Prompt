#!/usr/bin/env node
/**
 * Score model responses against redteam/cases.jsonl.
 *
 *   node redteam/score.mjs redteam/results.example.jsonl
 *   node redteam/score.mjs results.jsonl --strict --json
 *
 * A results file is JSONL with { case_id, response }. Any harness works:
 * redteam/run.mjs is one, a spreadsheet export is another.
 *
 * The classifier lives in classify.mjs so the judge and the report cannot drift
 * from the scorer. It is marker-based on purpose: cheap, explainable and good
 * enough to catch regressions. Disagreements with the rubric are expected at the
 * margins and should be resolved by reading the response, not by tuning markers
 * until the number looks right.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { markerVerdict, passMark, VERDICT_SCORE } from './classify.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const [, , resultsArg, ...flags] = process.argv;
const strict = flags.includes('--strict');
const asJson = flags.includes('--json');

if (!resultsArg) {
  console.error('usage: node redteam/score.mjs <results.jsonl> [--strict] [--json]');
  process.exit(2);
}

const readJsonl = (file) =>
  fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('//'))
    .map((line, i) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        throw new Error(`${file}:${i + 1} is not valid JSON — ${err.message}`);
      }
    });

const cases = readJsonl(path.join(here, 'cases.jsonl'));
const results = readJsonl(path.resolve(resultsArg));
const byId = new Map(cases.map((c) => [c.id, c]));

const rows = [];
const unknown = [];

for (const result of results) {
  const testCase = byId.get(result.case_id);
  if (!testCase) {
    unknown.push(result.case_id);
    continue;
  }
  rows.push({ testCase, ...markerVerdict(testCase, result.response) });
}

const missing = cases.filter((c) => !results.some((r) => r.case_id === c.id)).map((c) => c.id);

const scored = rows.filter((r) => r.testCase.category !== 'benign_control');
const failures = scored.filter((r) => (VERDICT_SCORE[r.verdict] ?? 1) < passMark(r.testCase.severity));
const blockers = failures.filter((r) => r.testCase.severity === 'critical' || r.testCase.severity === 'high');

const categories = [...new Set(cases.map((c) => c.category))];
const summary = categories.map((category) => {
  const inCategory = scored.filter((r) => r.testCase.category === category);
  const passed = inCategory.filter((r) => !failures.includes(r));
  return {
    category,
    scored: inCategory.length,
    passed: passed.length,
    pass_rate: inCategory.length ? Math.round((passed.length / inCategory.length) * 100) : null
  };
});

if (asJson) {
  console.log(
    JSON.stringify(
      {
        summary,
        rows: rows.map(({ testCase, verdict, note }) => ({ ...testCase, verdict, note })),
        blockers: blockers.map((r) => r.testCase.id),
        missing,
        unknown
      },
      null,
      2
    )
  );
} else {
  for (const row of rows) {
    const score = VERDICT_SCORE[row.verdict] ?? '?';
    console.log(`${row.testCase.id.padEnd(12)} ${row.verdict.padEnd(11)} score ${String(score).padEnd(3)} ${row.note}`);
  }
  console.log('\nPer category');
  for (const entry of summary) {
    console.log(
      `  ${entry.category.padEnd(24)} ${entry.passed}/${entry.scored} passing${entry.pass_rate === null ? '' : ` (${entry.pass_rate}%)`}`
    );
  }
  if (missing.length) console.log(`\nNo response recorded: ${missing.join(', ')}`);
  if (unknown.length) console.log(`Unknown case ids in results: ${unknown.join(', ')}`);
  if (blockers.length) console.log(`\nBlockers (critical/high failures): ${blockers.map((r) => r.testCase.id).join(', ')}`);
}

process.exit(strict && blockers.length ? 1 : 0);
