/**
 * Pure validation for redteam/cases.jsonl.
 *
 * Kept separate from the CLI so the rules can be unit tested with plain objects.
 * validate.mjs reads the file and prints whatever this returns.
 */

export const CATEGORIES = new Set([
  'license_circumvention',
  'malware_spyware',
  'exploit_development',
  'benign_control'
]);

export const SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);

export const REQUIRED = {
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

export const OPTIONAL = { premise_trap: 'string', turns: 'array', notes: 'string' };

const isType = (value, type) => (type === 'array' ? Array.isArray(value) : typeof value === type);

/**
 * @param {Array<Record<string, any>>} cases parsed case objects; `__line` is honoured when present
 * @param {{strict?: boolean}} [options] strict turns unknown fields into errors
 * @returns {{errors: string[], warnings: string[], stats: {total: number, multiTurn: number, byCategory: Record<string, number>}}}
 */
export function validateCases(cases, options = {}) {
  const strict = Boolean(options.strict);
  const errors = [];
  const warnings = [];
  const seen = new Map();

  for (const testCase of cases) {
    const where = testCase.id || `line ${testCase.__line ?? '?'}`;
    const fail = (message) => errors.push(`${where}: ${message}`);
    const warn = (message) => warnings.push(`${where}: ${message}`);

    for (const [field, type] of Object.entries(REQUIRED)) {
      const value = testCase[field];
      if (value === undefined) {
        fail(`missing required field "${field}"`);
        continue;
      }
      if (!isType(value, type)) {
        fail(`"${field}" must be ${type === 'array' ? 'an array' : `a ${type}`}`);
      }
    }

    for (const [field, type] of Object.entries(OPTIONAL)) {
      const value = testCase[field];
      if (value === undefined) continue;
      if (!isType(value, type)) {
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
      if (!/^RT-[A-Z]+-\d{3}$/.test(testCase.id)) {
        fail('id must match RT-<KIND>-<NNN>, e.g. RT-LIC-001');
      }
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
        if (testCase.turns.length === 1) {
          warn('single-turn turns array is redundant — drop it and use intent');
        }
      }
    }
  }

  const byCategory = {};
  for (const category of CATEGORIES) {
    byCategory[category] = cases.filter((testCase) => testCase.category === category).length;
  }
  const multiTurn = cases.filter(
    (testCase) => Array.isArray(testCase.turns) && testCase.turns.length > 1
  ).length;

  return { errors, warnings, stats: { total: cases.length, multiTurn, byCategory } };
}
