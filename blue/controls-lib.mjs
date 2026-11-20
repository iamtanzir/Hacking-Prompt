/**
 * Pure blue-team pairing rule: one control per tool, keyed by case id.
 *
 * Keyed by case rather than tool name because the inventory lists Invicti twice
 * (entries 1 and 10); a name-keyed map would silently drop one of them.
 *
 * @typedef {{name: string, case: string}} Tool
 *
 * @typedef {Object} Control
 * @property {string} tool
 * @property {string} case
 * @property {boolean} licenceGated
 * @property {string[]} detect
 * @property {string[]} harden
 * @property {string[]} mitre
 * @property {string} note
 *
 * @typedef {Object} ControlsStats
 * @property {number} tools
 * @property {number} controls
 * @property {number} signals
 * @property {number} techniques
 * @property {number} gated
 */

/**
 * @param {Tool[]} tools
 * @param {Control[]} controls
 * @returns {{errors: string[], stats: ControlsStats}}
 */
export function checkControls(tools, controls) {
  /** @type {string[]} */
  const errors = [];
  /** @type {Map<string, Tool>} */
  const toolByCase = new Map(tools.map((tool) => [tool.case, tool]));
  /** @type {Map<string, Control>} */
  const controlByCase = new Map();

  for (const control of controls) {
    if (!control.tool) {
      errors.push('control entry without a tool name');
      continue;
    }
    if (!control.case) {
      errors.push(`${control.tool}: control entry without a case id`);
      continue;
    }
    if (controlByCase.has(control.case)) {
      errors.push(`${control.tool}: duplicate control entry for ${control.case}`);
    }
    controlByCase.set(control.case, control);

    const tool = toolByCase.get(control.case);
    if (!tool) {
      errors.push(`${control.tool}: case ${control.case} is not in redteam/tools.json`);
      continue;
    }
    if (control.tool !== tool.name) {
      errors.push(`${control.case}: control names ${control.tool}, inventory says ${tool.name}`);
    }
    if (typeof control.licenceGated !== 'boolean') {
      errors.push(`${control.tool}: licenceGated must be a boolean`);
    }
    // Fields arrive as JSON, so they are read through a loose view and checked
    // before use; the typed shape above only describes what a valid entry looks like.
    /** @type {Record<string, unknown>} */
    const loose = control;
    for (const field of ['detect', 'harden', 'mitre']) {
      const value = loose[field];
      if (!Array.isArray(value) || value.length === 0) {
        errors.push(`${control.tool}: "${field}" must be a non-empty array`);
      }
    }
    for (const id of control.mitre || []) {
      if (!/^T\d{4}(\.\d{3})?$/.test(String(id))) {
        errors.push(`${control.tool}: "${id}" is not an ATT&CK technique id (T1234 or T1234.001)`);
      }
    }
    if (typeof control.note !== 'string' || !control.note.trim()) {
      errors.push(`${control.tool}: "note" must be a non-empty string`);
    }
  }

  for (const tool of tools) {
    if (!controlByCase.has(tool.case)) errors.push(`${tool.name}: no blue-team control entry for ${tool.case}`);
  }

  const signals = controls.reduce((sum, control) => sum + (control.detect?.length || 0), 0);
  const techniques = new Set(controls.flatMap((control) => control.mitre || []));

  return {
    errors,
    stats: {
      tools: tools.length,
      controls: controls.length,
      signals,
      techniques: techniques.size,
      gated: controls.filter((control) => control.licenceGated).length
    }
  };
}
