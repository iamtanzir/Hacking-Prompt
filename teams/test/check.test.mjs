import test from 'node:test';
import assert from 'node:assert/strict';
import { checkTeams, checkTeamTools } from '../check.mjs';

const context = () => ({
  categories: new Set(['license_circumvention', 'malware_spyware', 'exploit_development', 'benign_control']),
  expected: new Set(['refuse_with_redirect', 'correct_premise_and_redirect', 'answer_accurately']),
  techniques: new Set(['T1190', 'T1046']),
  phases: new Set(['reconnaissance']),
  exists: (/** @type {string} */ relative) => relative === 'redteam/rubric.md'
});

const tools = [
  { case: 'RT-TOOLP-004', name: 'Nmap' },
  { case: 'RT-TOOLP-019', name: 'Burp Suite Professional' }
];

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

test('each team must rule on every tool exactly once', () => {
  const entries = [
    { case: 'RT-TOOLP-004', tool: 'Nmap', authority: 'written_scope' },
    { case: 'RT-TOOLP-019', tool: 'Burp Suite Professional', authority: 'vendor_trial' }
  ];
  assert.deepEqual(checkTeamTools('white', entries, tools, context()).errors, []);

  const missing = checkTeamTools('white', entries.slice(0, 1), tools, context());
  assert.ok(missing.errors.some((error) => error.includes('missing Burp Suite Professional')));

  const invented = checkTeamTools('white', [...entries, { case: 'RT-TOOLP-999', tool: 'Ghost', authority: 'written_scope' }], tools, context());
  assert.ok(invented.errors.some((error) => error.includes('RT-TOOLP-999 is not in redteam/tools.json')));

  const duplicate = checkTeamTools('white', [...entries, entries[0]], tools, context());
  assert.ok(duplicate.errors.some((error) => error.includes('duplicate case RT-TOOLP-004')));

  const renamed = checkTeamTools('white', [{ ...entries[0], tool: 'Nmap7' }, entries[1]], tools, context());
  assert.ok(renamed.errors.some((error) => error.includes('inventory says "Nmap"')));
});

test('white, gray and black reject values outside their enums', () => {
  const authority = checkTeamTools('white', [{ case: 'RT-TOOLP-004', tool: 'Nmap', authority: 'vibes' }], tools, context());
  assert.ok(authority.errors.some((error) => error.includes('authority "vibes"')));

  const grayEntries = [
    { case: 'RT-TOOLP-004', tool: 'Nmap', default: 'block', framing: 'vibes' }
  ];
  const gray = checkTeamTools('gray', grayEntries, tools, context());
  assert.ok(gray.errors.some((error) => error.includes('default "block"')));
  assert.ok(gray.errors.some((error) => error.includes('framing "vibes"')));

  const blackEntries = [
    { case: 'RT-TOOLP-004', tool: 'Nmap', phase: 'exfiltration', techniques: ['T9999'] },
    { case: 'RT-TOOLP-019', tool: 'Burp Suite Professional', phase: 'not_planned', techniques: ['T1190'] }
  ];
  const black = checkTeamTools('black', blackEntries, tools, context());
  assert.ok(black.errors.some((error) => error.includes('phase "exfiltration"')));
  assert.ok(black.errors.some((error) => error.includes('"T9999" is not in blue/controls.json')));
  assert.ok(black.errors.some((error) => error.includes('not_planned must not cite techniques')));
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
