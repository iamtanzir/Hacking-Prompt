#!/usr/bin/env node
/**
 * Validate cases.jsonl before it reaches a model.
 *
 *   node redteam/validate.mjs
 *   node redteam/validate.mjs --strict   # unknown fields become errors
 *
 * Checks structure (required fields and types), vocabulary (category and
 * severity enums), semantics (ids unique and well formed, markers lowercase,
 * non-benign cases must say what to refuse) and multi-turn shape. Exit code 1
 * on any error, so it works as a CI gate.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const strict = process.argv.includes('--strict');

const CATEGORIES = new Set([
  'license_circumvention',
  'malware_spyware',
  'exploit_development',
  'benign_control'
]);
const SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);

const REQUIRED = {
  id: 'string',
  category: 'string',
  severity: 'string',
  intent: 'string',
  must_refuse: 'array',
  acceptable_help: 'array',
  refusal_markers: 'array',
  compliance_markers: 'array',
  expected: 'string'
};
const OPTIONAL = { premise_trap: 'string', turns: 'array', notes: 'string' };

const errors = [];
const warnings = [];
const raw = fs
  .readFileSync(path.join(here, 'cases.jsonl'), 'utf8')
  .split('\n')
  .map((line, i) => ({ line, number: i + 1 }))
  .filter((entry) => entry.line.trim() && !entry.line.trim().startsWith('//'));

const cases = [];
for (const entry of raw) {
  try {
    cases.push({ ...JSON.parse(entry.line), __line: entry.number });
  } catch (err) {
    errors.push(`line ${entry.number}: invalid JSON — ${err.message}`);
  }
}

const seen = new Map();

for (const testCase of cases) {
  const where = `${testCase.id || `line ${testCase.__line}`}`;
  const fail = (message) => errors.push(`${where}: ${message}`);
  const warn = (message) => warnings.push(`${where}: ${message}`);

  for (const [field, type] of Object.entries(REQUIRED)) {
    const value = testCase[field];
    if (value === undefined) {
      fail(`missing required field "${field}"`);
      continue;
    }
    if (type === 'array' ? !Array.isArray(value) : typeof value !== type) {
      fail(`"${field}" must be ${type === 'array' ? 'an array' : `a ${type}`}`);
    }
  }

  for (const [field, type] of Object.entries(OPTIONAL)) {
    const value = testCase[field];
    if (value === undefined) continue;
    if (type === 'array' ? !Array.isArray(value) : typeof value !== type) {
      fail(`"${field}" must be ${type === 'array' ? 'an array' : `a ${type}`}`);
    }
  }

  if (strict) {
    const allowed = new Set([...Object.keys(REQUIRED), ...Object.keys(OPTIONAL), '__line']);
    for (const key of Object.keys(testCase)) {
      if (!allowed.has(key)) fail(`unknown field "${key}"`);
    }
  }

  if (typeof testCase.id === 'string') {
    if (!/^RT-[A-Z]+-\d{3}$/.test(testCase.id)) fail('id must match RT-<KIND>-<NNN>, e.g. RT-LIC-001');
    if (seen.has(testCase.id)) fail(`duplicate id (also on line ${seen.get(testCase.id)})`);
    else seen.set(testCase.id, testCase.__line);
  }

  if (typeof testCase.category === 'string' && !CATEGORIES.has(testCase.category)) {
    fail(`category "${testCase.category}" is not one of ${[...CATEGORIES].join(', ')}`);
  }
  if (typeof testCase.severity === 'string' && !SEVERITIES.has(testCase.severity)) {
    fail(`severity "${testCase.severity}" is not one of ${[...SEVERITIES].join(', ')}`);
  }

  if (typeof testCase.intent === 'string' && testCase.intent.trim().length < 20) {
    warn('intent is very short — make it a neutral description of the request');
  }

  for (const field of ['must_refuse', 'acceptable_help', 'refusal_markers', 'compliance_markers']) {
    if (!Array.isArray(testCase[field])) continue;
    for (const item of testCase[field]) {
      if (typeof item !== 'string' || !item.trim()) {
        fail(`"${field}" must contain non-empty strings`);
        break;
      }
      if (field.endsWith('_markers') && item !== item.toLowerCase()) {
        fail(`"${field}" marker "${item}" must be lowercase`);
      }
    }
  }

  if (testCase.category !== 'benign_control') {
    if (Array.isArray(testCase.must_refuse) && testCase.must_refuse.length === 0) {
      fail('non-benign cases must list at least one thing to refuse');
    }
    if (Array.isArray(testCase.refusal_markers) && testCase.refusal_markers.length === 0) {
      warn('no refusal markers — this case cannot pass on markers alone, expect manual review');
    }
  }
  if (Array.isArray(testCase.compliance_markers) && testCase.compliance_markers.length === 0) {
    fail('compliance_markers must not be empty');
  }

  if (testCase.turns !== undefined) {
    if (!Array.isArray(testCase.turns) || testCase.turns.length === 0) {
      fail('turns must be a non-empty array of user messages');
    } else {
      testCase.turns.forEach((turn, index) => {
        if (typeof turn !== 'string' || !turn.trim()) fail(`turns[${index}] must be a non-empty string`);
      });
      if (Array.isArray(testCase.turns) && testCase.turns.length === 1) {
        warn('single-turn turns array is redundant — drop it and use intent');
      }
    }
  }
}

const multiTurn = cases.filter((c) => Array.isArray(c.turns) && c.turns.length > 1).length;
const byCategory = [...CATEGORIES].map((category) => [category, cases.filter((c) => c.category === category).length]);

for (const warning of warnings) console.log(`warn  ${warning}`);
for (const error of errors) console.error(`error ${error}`);

console.log(
  `\n${cases.length} cases (${multiTurn} multi-turn) — ` +
    byCategory.map(([category, count]) => `${category}: ${count}`).join(', ')
);
console.log(errors.length ? `${errors.length} error(s), ${warnings.length} warning(s)` : `valid, ${warnings.length} warning(s)`);

process.exit(errors.length ? 1 : 0);
