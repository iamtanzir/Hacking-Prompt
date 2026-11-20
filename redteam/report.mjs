#!/usr/bin/env node
/**
 * Turn results files into a Markdown report.
 *
 *   node redteam/report.mjs results.jsonl --out report.md
 *   node redteam/report.mjs gpt.jsonl claude.jsonl --out compare.md --title "August sweep"
 *
 * One section per results file, so a comparison is just two files in one call.
 * The report is regenerable and safe to commit; it contains short excerpts only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { markerVerdict, passMark, VERDICT_SCORE } from './classify.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const flag = (name, fallback = '') => {
  const index = argv.indexOf(name);
  return index === -1 ? fallback : argv[index + 1];
};
const out = flag('--out', 'report.md');
const title = flag('--title', 'Red-team evaluation report');
const files = argv.filter((arg, i) => !arg.startsWith('-') && arg.endsWith('.jsonl') && !argv[i - 1]?.startsWith('--'));

if (!files.length) {
  console.error('usage: node redteam/report.mjs <results.jsonl> [more.jsonl] [--out report.md] [--title "..."]');
  process.exit(2);
}

const cases = fs
  .readFileSync(path.join(here, 'cases.jsonl'), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const byId = new Map(cases.map((c) => [c.id, c]));

const escape = (text) => String(text).replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();
const truncate = (text, size = 180) => (String(text).length > size ? `${String(text).slice(0, size)}…` : String(text));

const sections = [];
const overview = [];

for (const file of files) {
  const rows = fs
    .readFileSync(path.resolve(file), 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        throw new Error(`${file}:${i + 1} is not valid JSON — ${err.message}`);
      }
    })
    .filter((row) => row.case_id && byId.has(row.case_id));

  const model = rows.find((row) => row.model)?.model || path.basename(file, '.jsonl');
  const scored = rows
    .filter((row) => byId.get(row.case_id).category !== 'benign_control')
    .map((row) => ({
      testCase: byId.get(row.case_id),
      response: row.response || '',
      ...markerVerdict(byId.get(row.case_id), row.response || '')
    }));
  const failures = scored.filter((row) => (VERDICT_SCORE[row.verdict] ?? 1) < passMark(row.testCase.severity));
  const blockers = failures.filter((row) => ['critical', 'high'].includes(row.testCase.severity));
  const coverage = rows.length;

  const byCategory = [...new Set(cases.map((c) => c.category))]
    .filter((category) => category !== 'benign_control')
    .map((category) => {
      const inCategory = scored.filter((row) => row.testCase.category === category);
      const passed = inCategory.filter((row) => !failures.includes(row));
      return {
        category,
        total: inCategory.length,
        passed: passed.length,
        rate: inCategory.length ? Math.round((passed.length / inCategory.length) * 100) : null
      };
    });

  overview.push({
    model,
    coverage: `${coverage}/${cases.length}`,
    pass: scored.length - failures.length,
    total: scored.length,
    blockers: blockers.length
  });

  const table = [
    '| Category | Passed | Cases | Rate |',
    '|---|---|---|---|',
    ...byCategory.map(
      (entry) => `| \`${entry.category}\` | ${entry.passed} | ${entry.total} | ${entry.rate === null ? '—' : `${entry.rate}%`} |`
    )
  ].join('\n');

  const failureList = failures.length
    ? failures
        .map(
          (row) =>
            `- **${row.testCase.id}** (\`${row.testCase.severity}\`, ${row.verdict}) — ${escape(row.note)}\n  > ${escape(truncate(row.response))}`
        )
        .join('\n')
    : '_None._';

  sections.push(
    [
      `## ${model}`,
      '',
      `Coverage: **${coverage}/${cases.length}** cases answered. Blockers: **${blockers.length}**.`,
      '',
      table,
      '',
      '### Failed cases',
      '',
      failureList,
      ''
    ].join('\n')
  );
}

const header = [
  `# ${title}`,
  '',
  `Generated ${new Date().toISOString()} from ${files.length} results file(s) by \`redteam/report.mjs\`.`,
  'Scores come from the marker classifier; treat disagreements with the rubric as prompts to read the reply (see `redteam/rubric.md`).',
  '',
  '| Model | Coverage | Passing | Scored | Blockers |',
  '|---|---|---|---|---|',
  ...overview.map((row) => `| ${row.model} | ${row.coverage} | ${row.pass} | ${row.total} | ${row.blockers} |`),
  ''
].join('\n');

const body = `${header}\n${sections.join('\n')}`;
fs.writeFileSync(path.resolve(out), body);
console.log(`Wrote ${out} — ${overview.length} model section(s), ${overview.reduce((sum, row) => sum + row.blockers, 0)} blocker(s).`);
