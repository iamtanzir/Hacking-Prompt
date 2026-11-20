# Contributing

Thanks for trying to improve the corpus. The bar is accuracy, not volume.

## Ground rules

1. **Descriptions, never procedures.** A case says what was asked and what a good answer
   may contain. It never contains a working patch, payload, offsets or a step-by-step
   route. If a contribution looks like an instruction, it is rejected on sight.
2. **Neutral intent.** Write `intent` so a reader who has never seen the original request
   understands the ask without being able to act on it.
3. **Evidence over vibes.** If you change a marker, a severity or a licence status, say
   which library or comparison produced the old value and supply a link for the new one.
4. **No real personal data.** Case text is public; keep it free of names, tokens, IPs and
   anything copied from a breach.
5. **Authorisation.** Do not submit results from testing systems you do not own or have
   written permission to test. Lab and platform results only.

## Local checks

```bash
npm ci          # installs TypeScript and @types/node (dev-only)
./scripts/check.sh
```

That runs the schema gate, the coverage gate, the blue-team gate, the JSDoc typecheck, the
unit tests, the scorer on the bundled samples, the dry runs and the report render. CI runs
the same steps, so a green local run should mean a green PR.

`npm run typecheck` alone is the fast loop when you only touched a comment or a typedef.
Two configs run: `tsconfig.json` covers every `.mjs` with `checkJs`, and
`tsconfig.strict.json` enforces `strict` on the modules listed in its `include` array.
`redteam/classify.mjs`, `redteam/validate-cases.mjs`, `redteam/coverage-lib.mjs` and
`blue/controls-lib.mjs` are strict today; to move a module up, make it strict-clean and add
it to that list in the same PR. Do not lower `strict` to get a file through.

If you change `classify.mjs`, `validate-cases.mjs`, `coverage-lib.mjs` or `blue/controls-lib.mjs`,
change the matching test in the same commit. A verdict rule without a test is a guess that
will drift.

Gate logic and its CLI are separate on purpose: the `*-lib.mjs` files and
`validate-cases.mjs` are pure functions over data, so they can be tested without touching
disk. Keep new rules there, and keep the CLI a thin reader.

## Adding a case

1. Append one JSON object per line to `redteam/cases.jsonl`.
2. If it covers a tool, add the tool to `redteam/tools.json` with the case id and aliases,
   and add the row to `redteam/inventory.md`.
3. Fill every field: `id` (`RT-<KIND>-<NNN>`), `category`, `severity`, `intent`,
   `must_refuse`, `acceptable_help`, `refusal_markers`, `compliance_markers`, `expected`.
4. Use `turns` only for a real escalation; a one-element `turns` array is rejected by
   `validate.mjs --strict`.
5. Run `node redteam/validate.mjs --strict && node redteam/coverage.mjs`.

## Changing the scorer

Verdict logic lives in `redteam/classify.mjs` and nowhere else. Changing a threshold in
one consumer is how the report and the scorer start disagreeing; make the change once, in
`classify.mjs`, and add a note to `CHANGELOG.md`.

## Commits and pull requests

- Conventional prefix: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `ci:`.
- One concern per commit; the body explains why, not what (the diff already says what).
- PR description: what changed, which checks ran, and anything reviewers should not trust.
- Link the issue with `Closes #<n>` when there is one.

## Review

Small, focused PRs get reviewed fastest. A PR that rewrites the taxonomy and the marker
list at once will be asked to split. If you disagree with a refusal decision, open an issue
with the case id and the rubric line you think is wrong — that is a legitimate bug report.
