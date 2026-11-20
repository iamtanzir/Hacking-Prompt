#!/usr/bin/env node
/**
 * Colour-team gate.
 *
 *   node teams/check.mjs
 *
 * The white, gray and black packs claim things that other files already describe.
 * This gate makes those claims checkable:
 *   - gray may only use categories and expectations present in cases.jsonl
 *   - black may only cite ATT&CK techniques present in blue/controls.json
 *   - white must point at a rubric that exists
 *
 * The rule lives in checkTeams so it can be unit tested; this file loads the data.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

/**
 * @typedef {{team: string, purpose: string}} Pack
 * @typedef {Object} Context
 * @property {Set<string>} categories categories used by the case file
 * @property {Set<string>} expected expected verdicts used by the case file
 * @property {Set<string>} techniques ATT&CK ids present in blue/controls.json
 * @property {(relativePath: string) => boolean} exists resolves a repo-relative path
 *
 * @param {{white: any, gray: any, black: any}} packs
 * @param {Context} context
 */
export function checkTeams(packs, context) {
  /** @type {string[]} */
  const errors = [];
  const fail = (/** @type {string} */ message) => errors.push(message);

  for (const [key, pack] of Object.entries(packs)) {
    if (!pack || typeof pack !== 'object') {
      fail(`${key}: pack is missing or not an object`);
      continue;
    }
    if (pack.team !== key) fail(`${key}: "team" must be "${key}", found "${pack.team}"`);
    if (typeof pack.purpose !== 'string' || !pack.purpose.trim()) fail(`${key}: "purpose" is required`);
  }

  const white = packs.white || {};
  const required = white.authorization?.required;
  if (!Array.isArray(required) || required.length === 0) {
    fail('white: authorization.required must list at least one precondition');
  }
  if (!Array.isArray(white.stop_conditions) || white.stop_conditions.length === 0) {
    fail('white: stop_conditions must not be empty');
  }
  const rubric = white.scoring?.rubric;
  if (typeof rubric !== 'string' || !rubric.trim()) {
    fail('white: scoring.rubric must name a file');
  } else if (!context.exists(rubric)) {
    fail(`white: scoring.rubric "${rubric}" does not exist`);
  }

  const decisions = packs.gray?.decisions;
  if (!Array.isArray(decisions) || decisions.length === 0) {
    fail('gray: decisions must not be empty');
  } else {
    decisions.forEach((/** @type {any} */ decision, /** @type {number} */ index) => {
      const where = `gray decisions[${index}]`;
      if (typeof decision?.signal !== 'string' || !decision.signal.trim()) {
        fail(`${where}: "signal" is required`);
      }
      if (!context.categories.has(decision?.category)) {
        fail(`${where}: category "${decision?.category}" is not used by cases.jsonl`);
      }
      if (!context.expected.has(decision?.expected)) {
        fail(`${where}: expected "${decision?.expected}" is not used by cases.jsonl`);
      }
    });
  }

  const phases = packs.black?.phases;
  if (!Array.isArray(phases) || phases.length === 0) {
    fail('black: phases must not be empty');
  } else {
    /** @type {Set<string>} */
    const seen = new Set();
    phases.forEach((/** @type {any} */ phase, /** @type {number} */ index) => {
      const name = phase?.phase;
      if (typeof name !== 'string' || !name.trim()) {
        fail(`black phases[${index}]: "phase" is required`);
      } else if (seen.has(name)) {
        fail(`black phases[${index}]: duplicate phase "${name}"`);
      } else {
        seen.add(name);
      }
      if (!Array.isArray(phase?.techniques) || phase.techniques.length === 0) {
        fail(`black phases[${index}]: "techniques" must not be empty`);
        return;
      }
      for (const technique of phase.techniques) {
        if (!context.techniques.has(technique)) {
          fail(`black phases[${index}]: "${technique}" is not in blue/controls.json`);
        }
      }
      const categories = phase.case_categories;
      if (!Array.isArray(categories) || categories.length === 0) {
        fail(`black phases[${index}]: "case_categories" must not be empty`);
      } else {
        for (const category of categories) {
          if (!context.categories.has(category)) {
            fail(`black phases[${index}]: category "${category}" is not used by cases.jsonl`);
          }
        }
      }
    });
  }

  return {
    errors,
    stats: {
      teams: Object.keys(packs).length,
      decisions: Array.isArray(decisions) ? decisions.length : 0,
      phases: Array.isArray(phases) ? phases.length : 0,
      stopConditions: Array.isArray(white.stop_conditions) ? white.stop_conditions.length : 0
    }
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const read = (/** @type {string} */ relative) =>
    JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
  const cases = fs
    .readFileSync(path.join(root, 'redteam', 'cases.jsonl'), 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const controls = read('blue/controls.json');

  const { errors, stats } = checkTeams(
    { white: read('white/roe.json'), gray: read('gray/triage.json'), black: read('black/emulation.json') },
    {
      categories: new Set(cases.map((testCase) => testCase.category)),
      expected: new Set(cases.map((testCase) => testCase.expected)),
      techniques: new Set(controls.flatMap((control) => control.mitre || [])),
      exists: (relative) => fs.existsSync(path.join(root, relative))
    }
  );

  for (const error of errors) console.error(`error ${error}`);
  console.log(
    `${stats.teams} packs, ${stats.stopConditions} stop conditions, ` +
      `${stats.decisions} triage decisions, ${stats.phases} emulation phases`
  );
  console.log(errors.length ? `${errors.length} error(s)` : 'aligned with the case file and the control map');
  process.exit(errors.length ? 1 : 0);
}
