#!/usr/bin/env node
/**
 * Colour-team gate.
 *
 *   node teams/check.mjs
 *
 * The white, gray and black packs claim things that other files already describe.
 * This gate makes those claims checkable:
 *   - every team rules on exactly the tools in redteam/tools.json, no gaps and no extras
 *   - gray may only use categories and expectations present in cases.jsonl
 *   - black may only cite phases it declares and ATT&CK techniques blue covers
 *   - white must point at a rubric that exists
 *
 * The rule lives in checkTeams so it can be unit tested; this file loads the data.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {string} */
const here = path.dirname(fileURLToPath(import.meta.url));
/** @type {string} */
const root = path.join(here, '..');

/**
 * @typedef {Object} Pack
 * @property {string} team
 * @property {string} purpose
 * @property {Object} [authorization]
 * @property {string[]} [authorization.required]
 * @property {string[]} [stop_conditions]
 * @property {Object} [scoring]
 * @property {string} [scoring.rubric]
 * @property {Array<{signal?: string, category?: string, expected?: string}>} [decisions]
 * @property {{phase: string, techniques: string[], case_categories?: string[]}[]} [phases]
 * @typedef {Object} Context
 * @property {Set<string>} categories categories used by the case file
 * @property {Set<string>} expected expected verdicts used by the case file
 * @property {Set<string>} techniques ATT&CK ids present in blue/controls.json
 * @property {Set<string>} phases phase names declared in black/emulation.json
 * @property {(relativePath: string) => boolean} exists resolves a repo-relative path
 */

/** Authority rulings white may hand out. */
export const AUTHORITIES = new Set(['written_scope', 'vendor_trial', 'isolated_lab']);

/** Request framings gray may use. */
export const FRAMINGS = new Set(['licence_bypass', 'operational_steps', 'concept', 'defence']);

/** Tools black deliberately leaves out of an emulation plan. */
export const NOT_PLANNED = 'not_planned';

/**
 * Per-team tool coverage. Every team must rule on exactly the tools in
 * redteam/tools.json: no tool missing, no tool invented, no case listed twice.
 * That is what stops the packs from drifting away from the transcript's list.
 *
 * @param {'white'|'gray'|'black'} team
 * @param {any[]} entries
 * @param {Array<{case: string, name: string}>} tools
 * @param {Context} context
 */
export function checkTeamTools(team, entries, tools, context) {
  /** @type {string[]} */
  const errors = [];
  if (!Array.isArray(entries) || entries.length === 0) {
    return { errors: [`${team}/tools.json: no entries`], stats: { entries: 0, covered: 0 } };
  }

  const byCase = new Map(tools.map((tool) => [tool.case, tool.name]));
  /** @type {Set<string>} */
  const seen = new Set();

  entries.forEach((entry, index) => {
    const where = `${team}/tools.json[${index}]`;
    if (typeof entry?.case !== 'string' || !entry.case) {
      errors.push(`${where}: "case" is required`);
      return;
    }
    if (seen.has(entry.case)) errors.push(`${where}: duplicate case ${entry.case}`);
    seen.add(entry.case);

    if (!byCase.has(entry.case)) {
      errors.push(`${where}: ${entry.case} is not in redteam/tools.json`);
      return;
    }
    if (entry.tool !== byCase.get(entry.case)) {
      errors.push(`${where}: tool is "${entry.tool}", inventory says "${byCase.get(entry.case)}"`);
    }

    if (team === 'white' && !AUTHORITIES.has(entry.authority)) {
      errors.push(`${where}: authority "${entry.authority}" is not one of ${[...AUTHORITIES].join(', ')}`);
    }
    if (team === 'gray') {
      if (!context.expected.has(entry.default)) {
        errors.push(`${where}: default "${entry.default}" is not used by cases.jsonl`);
      }
      if (!FRAMINGS.has(entry.framing)) {
        errors.push(`${where}: framing "${entry.framing}" is not one of ${[...FRAMINGS].join(', ')}`);
      }
    }
    if (team === 'black') {
      const planned = entry.phase !== NOT_PLANNED;
      if (planned && !context.phases.has(entry.phase)) {
        errors.push(`${where}: phase "${entry.phase}" is not declared in black/emulation.json`);
      }
      if (!Array.isArray(entry.techniques)) {
        errors.push(`${where}: "techniques" must be an array`);
        return;
      }
      if (planned && entry.techniques.length === 0) {
        errors.push(`${where}: a planned phase needs at least one technique`);
      }
      if (!planned && entry.techniques.length > 0) {
        errors.push(`${where}: ${NOT_PLANNED} must not cite techniques`);
      }
      for (const technique of entry.techniques) {
        if (!context.techniques.has(technique)) {
          errors.push(`${where}: "${technique}" is not in blue/controls.json`);
        }
      }
    }
  });

  for (const tool of tools) {
    if (!seen.has(tool.case)) errors.push(`${team}/tools.json: missing ${tool.name} (${tool.case})`);
  }

  const covered = tools.filter((tool) => seen.has(tool.case)).length;
  return { errors, stats: { entries: entries.length, covered } };
}

/**
 * @param {{white?: Pack, gray?: Pack, black?: Pack}} packs
 * @param {Context} context
 * @returns {{errors: string[], stats: {teams: number, decisions: number, phases: number, stopConditions: number}}}
 */
export function checkTeams(packs, context) {
  /** @type {string[]} */
  const errors = [];
    const fail = (message) => errors.push(message);

  for (const [key, pack] of Object.entries(packs)) {
    if (!pack || typeof pack !== 'object') {
      fail(`${key}: pack is missing or not an object`);
      continue;
    }
    if (pack.team !== key) fail(`${key}: "team" must be "${key}", found "${pack.team}"`);
    if (typeof pack.purpose !== 'string' || !pack.purpose.trim()) fail(`${key}: "purpose" is required`);
  }

  const white = packs.white || { team: 'white', purpose: '' };
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
    decisions.forEach((decision /* : {signal?: string, category?: string, expected?: string} */ , index) => {
      const where = `gray decisions[${index}]`;
      const signal = decision?.signal;
      if (typeof signal !== 'string' || !signal.trim()) {
        fail(`${where}: "signal" is required`);
      }
      const category = decision?.category ?? undefined;
      if (typeof category === 'string' && !context.categories.has(category)) {
        fail(`${where}: category "${category}" is not used by cases.jsonl`);
      }
      const expected = decision?.expected ?? undefined;
      if (typeof expected === 'string' && !context.expected.has(expected)) {
        fail(`${where}: expected "${expected}" is not used by cases.jsonl`);
      }
    });
  }

  const phases = packs.black?.phases;
  if (!Array.isArray(phases) || phases.length === 0) {
    fail('black: phases must not be empty');
  } else {
    /** @type {Set<string>} */
    const seen = new Set();
    phases.forEach((phase, index) => {
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
  /**
   * @param {string} relative
   * @returns {any}
   */
  const read = (relative) =>
    JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
  const cases = fs
    .readFileSync(path.join(root, 'redteam', 'cases.jsonl'), 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const controls = read('blue/controls.json');
  const tools = read('redteam/tools.json');
  const white = read('white/roe.json');
  const gray = read('gray/triage.json');
  const black = read('black/emulation.json');

  const context = {
    categories: new Set(cases.map((testCase) => testCase.category)),
    expected: new Set(cases.map((testCase) => testCase.expected)),
    techniques: new Set(controls.flatMap((control) => control.mitre || [])),
    phases: new Set(black.phases.map((phase) => phase.phase)),
    exists: (relative) => fs.existsSync(path.join(root, relative))
  };

  const packs = checkTeams({ white, gray, black }, context);
  const toolPacks = [
    checkTeamTools('white', read('white/tools.json'), tools, context),
    checkTeamTools('gray', read('gray/tools.json'), tools, context),
    checkTeamTools('black', read('black/tools.json'), tools, context)
  ];

  const errors = [...packs.errors, ...toolPacks.flatMap((pack) => pack.errors)];
  for (const error of errors) console.error(`error ${error}`);
  console.log(
    `${packs.stats.teams} packs, ${packs.stats.stopConditions} stop conditions, ` +
      `${packs.stats.decisions} triage decisions, ${packs.stats.phases} emulation phases`
  );
  console.log(
    toolPacks
      .map((pack, index) => `${['white', 'gray', 'black'][index]}: ${pack.stats.covered}/${tools.length} tools`)
      .join(', ')
  );
  console.log(errors.length ? `${errors.length} error(s)` : 'aligned with the case file, the transcript and the control map');
  process.exit(errors.length ? 1 : 0);
}
