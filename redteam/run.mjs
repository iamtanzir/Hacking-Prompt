#!/usr/bin/env node
/**
 * Send every case to an OpenAI-compatible chat endpoint and record the replies.
 *
 *   node redteam/run.mjs --dry-run
 *   OPENAI_BASE_URL=https://api.openai.com/v1 OPENAI_API_KEY=... \
 *     node redteam/run.mjs --model gpt-4o-mini --out results.jsonl
 *
 * Flags:
 *   --model <name>     required unless --dry-run
 *   --base-url <url>   overrides OPENAI_BASE_URL (default https://api.openai.com/v1)
 *   --out <file>       default results.jsonl
 *   --limit <n>        send only the first n cases
 *   --only <id,id>     send specific case ids
 *   --system <text>    optional system message prepended to every request
 *   --max-tokens <n>   default 900
 *   --delay <ms>       pause between requests, default 250
 *   --dry-run          print the request payloads and write nothing
 *
 * Keys come from the environment only. Nothing here writes a credential to disk.
 * The output file is JSONL of { case_id, response } (plus model and timestamp),
 * which is exactly what score.mjs consumes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const opts = {
    model: '',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    out: 'results.jsonl',
    limit: 0,
    only: [],
    system: '',
    maxTokens: 900,
    delay: 250,
    dryRun: false
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => argv[++i];
    switch (arg) {
      case '--model': opts.model = value(); break;
      case '--base-url': opts.baseUrl = value(); break;
      case '--out': opts.out = value(); break;
      case '--limit': opts.limit = Number(value()) || 0; break;
      case '--only': opts.only = String(value() || '').split(',').map((s) => s.trim()).filter(Boolean); break;
      case '--system': opts.system = value(); break;
      case '--max-tokens': opts.maxTokens = Number(value()) || 900; break;
      case '--delay': opts.delay = Number(value()) || 0; break;
      case '--dry-run': opts.dryRun = true; break;
      case '-h':
      case '--help': opts.help = true; break;
      default:
        if (arg.startsWith('-')) throw new Error(`unknown flag ${arg}`);
    }
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));

if (opts.help) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
  process.exit(0);
}

const cases = fs
  .readFileSync(path.join(here, 'cases.jsonl'), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line, i) => {
    try {
      return JSON.parse(line);
    } catch (err) {
      throw new Error(`cases.jsonl:${i + 1} is not valid JSON — ${err.message}`);
    }
  });

let selected = cases;
if (opts.only.length) selected = selected.filter((c) => opts.only.includes(c.id));
if (opts.limit > 0) selected = selected.slice(0, opts.limit);

if (!selected.length) {
  console.error('No cases selected.');
  process.exit(2);
}

const buildBody = (testCase) => ({
  model: opts.model || 'model-under-test',
  messages: [
    ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
    { role: 'user', content: testCase.intent }
  ],
  max_tokens: opts.maxTokens,
  temperature: 0
});

if (opts.dryRun) {
  console.log(`Base URL: ${opts.baseUrl}`);
  console.log(`Cases: ${selected.length}\n`);
  for (const testCase of selected) {
    console.log(`# ${testCase.id} (${testCase.category}, ${testCase.severity})`);
    console.log(JSON.stringify(buildBody(testCase), null, 2));
    console.log('');
  }
  console.log(`Dry run — nothing sent, nothing written. Drop --dry-run and pass --model to run.`);
  process.exit(0);
}

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('OPENAI_API_KEY is not set. Export it, or use --dry-run to preview the requests.');
  process.exit(2);
}
if (!opts.model) {
  console.error('--model is required (for example --model gpt-4o-mini). Use --dry-run to preview without a model.');
  process.exit(2);
}

const url = `${opts.baseUrl.replace(/\/+$/, '')}/chat/completions`;
const outPath = path.resolve(opts.out);
fs.writeFileSync(outPath, '');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

console.log(`POST ${url}`);
console.log(`model: ${opts.model} | cases: ${selected.length} | out: ${outPath}\n`);

let failures = 0;
for (const [index, testCase] of selected.entries()) {
  const label = `[${index + 1}/${selected.length}] ${testCase.id}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(buildBody(testCase))
    });
    const text = await res.text();
    if (!res.ok) {
      failures++;
      fs.appendFileSync(outPath, JSON.stringify({ case_id: testCase.id, error: `HTTP ${res.status}`, detail: text.slice(0, 500) }) + '\n');
      console.log(`${label}  HTTP ${res.status} — recorded as an error row`);
      continue;
    }
    const data = JSON.parse(text);
    const response = data?.choices?.[0]?.message?.content ?? '';
    fs.appendFileSync(
      outPath,
      JSON.stringify({ case_id: testCase.id, model: opts.model, at: new Date().toISOString(), response }) + '\n'
    );
    console.log(`${label}  ${response ? `${response.length} chars` : 'empty reply'}`);
  } catch (err) {
    failures++;
    fs.appendFileSync(outPath, JSON.stringify({ case_id: testCase.id, error: 'request failed', detail: String(err?.message || err) }) + '\n');
    console.log(`${label}  request failed — recorded as an error row`);
  }
  if (opts.delay) await sleep(opts.delay);
}

console.log(`\nDone. ${selected.length - failures}/${selected.length} replies recorded to ${outPath}`);
console.log(`Next: node redteam/score.mjs ${path.relative(process.cwd(), outPath) || outPath}`);
process.exit(failures ? 1 : 0);
