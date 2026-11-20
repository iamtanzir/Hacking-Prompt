import test from 'node:test';
import assert from 'node:assert/strict';
import { checkTeams } from '../check.mjs';

const context = () => ({
  categories: new Set(['license_circumvention', 'malware_spyware', 'exploit_development', 'benign_control']),
  expected: new Set(['refuse_with_redirect', 'correct_premise_and_redirect', 'answer_accurately']),
  techniques: new Set(['T1190', 'T1046']),
  exists: (/** @type {string} */ relative) => relative === 'redteam/rubric.md'
});

const packs = () => ({
  white: {
    team: 'white',
    purpose: 'owns authority and scope',
    authorization: { required: ['named owner'] },
    stop_conditions: ['out of scope'],
    scoring: { rubric: 'redteam/rubric.md' }
  },
  gray: {
    team: 'gray',
    purpose: 'triages ambiguity',
    decisions: [{ signal: 'asks for working steps', category: 'exploit_development', expected: 'refuse_with_redirect' }]
  },
  black: {
    team: 'black',
    purpose: 'plans emulation',
    phases: [{ phase: 'reconnaissance', techniques: ['T1046'], case_categories: ['benign_control'] }]
  }
});

test('a complete set of packs passes', () => {
  const { errors, stats } = checkTeams(packs(), context());
  assert.deepEqual(errors, []);
  assert.equal(stats.teams, 3);
  assert.equal(stats.decisions, 1);
  assert.equal(stats.phases, 1);
});

test('a pack named for the wrong team is rejected', () => {
  const broken = packs();
  broken.gray.team = 'green';
  const { errors } = checkTeams(broken, context());
  assert.ok(errors.some((error) => error.includes('"team" must be "gray"')));
});

test('white needs stop conditions and an existing rubric', () => {
  const broken = packs();
  broken.white.stop_conditions = [];
  broken.white.scoring.rubric = 'docs/missing.md';
  const { errors } = checkTeams(broken, context());
  assert.ok(errors.some((error) => error.includes('stop_conditions')));
  assert.ok(errors.some((error) => error.includes('does not exist')));
});

test('gray may not invent categories or expectations', () => {
  const broken = packs();
  broken.gray.decisions.push({ signal: 'made up', category: 'piracy', expected: 'block' });
  const { errors } = checkTeams(broken, context());
  assert.ok(errors.some((error) => error.includes('"piracy" is not used by cases.jsonl')));
  assert.ok(errors.some((error) => error.includes('"block" is not used by cases.jsonl')));
});

test('black may only cite techniques blue covers', () => {
  const broken = packs();
  broken.black.phases.push({ phase: 'exfiltration', techniques: ['T9999'], case_categories: ['benign_control'] });
  const { errors } = checkTeams(broken, context());
  assert.ok(errors.some((error) => error.includes('"T9999" is not in blue/controls.json')));
});

test('black phases must be unique and non-empty', () => {
  const broken = packs();
  broken.black.phases = [
    { phase: 'reconnaissance', techniques: ['T1046'], case_categories: ['benign_control'] },
    { phase: 'reconnaissance', techniques: [], case_categories: ['benign_control'] }
  ];
  const { errors } = checkTeams(broken, context());
  assert.ok(errors.some((error) => error.includes('duplicate phase')));
  assert.ok(errors.some((error) => error.includes('"techniques" must not be empty')));
});
