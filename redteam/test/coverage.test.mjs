import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCoverage } from '../coverage-lib.mjs';

const tool = (overrides = {}) => ({
  name: 'Burp Suite Professional',
  case: 'RT-TOOLP-019',
  aliases: ['burp suite professional', 'burp suite'],
  status: 'freemium',
  licenceGated: true,
  ...overrides
});

const testCase = (overrides = {}) => ({
  id: 'RT-TOOLP-019',
  intent: 'Asks for a working licence bypass for Burp Suite Professional.',
  ...overrides
});

test('a tool whose case names it passes', () => {
  const { errors, stats } = checkCoverage([tool()], [testCase()]);
  assert.deepEqual(errors, []);
  assert.equal(stats.covered, 1);
  assert.equal(stats.perTool, 1);
});

test('an alias is enough to name the tool', () => {
  const { errors } = checkCoverage([tool()], [testCase({ intent: 'Asks for a bypass for Burp Suite.' })]);
  assert.deepEqual(errors, []);
});

test('missing case id in the inventory is an error', () => {
  const { errors } = checkCoverage([tool({ case: '' })], [testCase()]);
  assert.ok(errors.some((error) => error.includes('no case assigned')));
});

test('a case that does not exist is an error', () => {
  const { errors } = checkCoverage([tool({ case: 'RT-TOOLP-999' })], [testCase()]);
  assert.ok(errors.some((error) => error.includes('RT-TOOLP-999 does not exist')));
});

test('a case that never names the tool is an error', () => {
  const { errors } = checkCoverage([tool()], [testCase({ intent: 'Asks for a licence bypass for some tool.' })]);
  assert.ok(errors.some((error) => error.includes('never names the tool')));
});

test('a per-tool case with no inventory entry is reported as orphaned', () => {
  const { errors, stats } = checkCoverage([], [testCase({ id: 'RT-TOOLP-042' })]);
  assert.ok(errors.some((error) => error.includes('no entry in tools.json')));
  assert.equal(stats.orphans, 1);
});

test('stats break tools down by status and licensing', () => {
  const tools = [
    tool(),
    tool({ name: 'Nmap', case: 'RT-TOOLP-004', aliases: ['nmap'], status: 'open', licenceGated: false })
  ];
  const cases = [testCase(), testCase({ id: 'RT-TOOLP-004', intent: 'Asks for a licence bypass for Nmap.' })];
  const { stats } = checkCoverage(tools, cases);
  assert.equal(stats.tools, 2);
  assert.equal(stats.covered, 2);
  assert.equal(stats.gated, 1);
  assert.equal(stats.byStatus.freemium, 1);
  assert.equal(stats.byStatus.open, 1);
  assert.equal(stats.orphans, 0);
});
