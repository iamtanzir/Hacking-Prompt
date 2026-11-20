import test from 'node:test';
import assert from 'node:assert/strict';
import { checkControls } from '../controls-lib.mjs';

const tool = (overrides = {}) => ({ name: 'Nmap', case: 'RT-TOOLP-004', ...overrides });

const control = (overrides = {}) => ({
  tool: 'Nmap',
  case: 'RT-TOOLP-004',
  licenceGated: false,
  detect: ['port sweeps from one source'],
  harden: ['default-deny ingress'],
  mitre: ['T1046'],
  note: 'Free tool; detection matters more than acquisition.',
  ...overrides
});

test('a paired control passes', () => {
  const { errors, stats } = checkControls([tool()], [control()]);
  assert.deepEqual(errors, []);
  assert.equal(stats.tools, 1);
  assert.equal(stats.controls, 1);
  assert.equal(stats.signals, 1);
  assert.equal(stats.techniques, 1);
});

test('a tool without a control is an error', () => {
  const { errors } = checkControls([tool({ case: 'RT-TOOLP-036', name: 'IDA Pro' })], [control()]);
  assert.ok(errors.some((error) => error.includes('no blue-team control entry for RT-TOOLP-036')));
});

test('a control for an unknown case is an error', () => {
  const { errors } = checkControls([], [control()]);
  assert.ok(errors.some((error) => error.includes('RT-TOOLP-004 is not in redteam/tools.json')));
});

test('a control naming a different tool is an error', () => {
  const { errors } = checkControls([tool()], [control({ tool: 'Kismet' })]);
  assert.ok(errors.some((error) => error.includes('control names Kismet')));
});

test('duplicate controls for one case are rejected', () => {
  const { errors } = checkControls([tool()], [control(), control()]);
  assert.ok(errors.some((error) => error.includes('duplicate control entry')));
});

test('empty detect, harden or mitre is rejected', () => {
  const { errors } = checkControls([tool()], [control({ detect: [], harden: [], mitre: [] })]);
  for (const field of ['detect', 'harden', 'mitre']) {
    assert.ok(errors.some((error) => error.includes(`"${field}" must be a non-empty array`)), field);
  }
});

test('malformed ATT&CK ids are rejected', () => {
  const { errors } = checkControls([tool()], [control({ mitre: ['1046', 'T1046.1'] })]);
  assert.equal(errors.filter((error) => error.includes('ATT&CK')).length, 2);
});

test('licenceGated must be a boolean and note must be present', () => {
  const { errors } = checkControls([tool()], [control({ licenceGated: 'no', note: '  ' })]);
  assert.ok(errors.some((error) => error.includes('licenceGated must be a boolean')));
  assert.ok(errors.some((error) => error.includes('"note"')));
});

test('the same tool listed twice with two cases needs two controls', () => {
  const tools = [
    tool({ name: 'Invicti', case: 'RT-TOOLP-001' }),
    tool({ name: 'Invicti', case: 'RT-TOOLP-010' })
  ];
  const controls = [
    control({ tool: 'Invicti', case: 'RT-TOOLP-001' }),
    control({ tool: 'Invicti', case: 'RT-TOOLP-010' })
  ];
  assert.deepEqual(checkControls(tools, controls).errors, []);
  const missing = checkControls(tools, [controls[0]]).errors;
  assert.ok(missing.some((error) => error.includes('RT-TOOLP-010')));
});
