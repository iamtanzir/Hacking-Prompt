/**
 * Pure coverage rule: every tool in tools.json must have a case that names it, and
 * every per-tool case must have an inventory entry. Kept separate from the CLI so
 * the rule can be unit tested with fixtures.
 *
 * @typedef {Object} Tool
 * @property {string} name display name as the transcript uses it
 * @property {string} case the case id responsible for this tool
 * @property {string[]} aliases lowercase names a case may use to name the tool
 * @property {string} status commercial, freemium, freeware, open or distro
 * @property {boolean} licenceGated whether the transcript asked for a licence bypass
 *
 * @typedef {{id: string}} CaseRef only the id is read; the text is matched separately
 *
 * @typedef {Object} CoverageStats
 * @property {number} tools
 * @property {number} covered
 * @property {Record<string, number>} byStatus
 * @property {number} gated
 * @property {number} perTool
 * @property {number} orphans
 */

const PER_TOOL_PREFIX = 'RT-TOOLP-';

/**
 * @param {Tool[]} tools
 * @param {CaseRef[]} cases
 * @returns {{errors: string[], stats: CoverageStats}}
 */
export function checkCoverage(tools, cases) {
  /** @type {string[]} */
  const errors = [];
  /** @type {Set<string>} */
  const failedTools = new Set();
  const textOf = new Map(cases.map((testCase) => [testCase.id, JSON.stringify(testCase).toLowerCase()]));

  for (const tool of tools) {
    /** @param {string} message */
    const fail = (message) => {
      errors.push(message);
      failedTools.add(tool.name);
    };

    if (!tool.case) {
      fail(`${tool.name}: no case assigned in tools.json`);
      continue;
    }
    const text = textOf.get(tool.case);
    if (!text) {
      fail(`${tool.name}: case ${tool.case} does not exist in cases.jsonl`);
      continue;
    }
    const named = (tool.aliases || []).some((alias) => text.includes(String(alias).toLowerCase()));
    if (!named) {
      fail(`${tool.name}: case ${tool.case} never names the tool (aliases: ${tool.aliases.join(', ')})`);
    }
  }

  const perTool = cases.filter((testCase) => testCase.id.startsWith(PER_TOOL_PREFIX));
  const inventoried = new Set(tools.map((tool) => tool.case));
  const orphans = perTool.map((testCase) => testCase.id).filter((id) => !inventoried.has(id));
  for (const id of orphans) errors.push(`case ${id} has no entry in tools.json`);

  /** @type {Record<string, number>} */
  const byStatus = {};
  for (const tool of tools) byStatus[tool.status] = (byStatus[tool.status] || 0) + 1;
  const gated = tools.filter((tool) => tool.licenceGated).length;

  return {
    errors,
    stats: {
      tools: tools.length,
      covered: tools.length - failedTools.size,
      byStatus,
      gated,
      perTool: perTool.length,
      orphans: orphans.length
    }
  };
}
