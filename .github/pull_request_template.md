## What changed

<!-- One paragraph. Which files, which behaviour. -->

## Why

<!-- The problem this solves. Link the issue: Closes #123 -->

## Type

- [ ] New case(s) — no operational detail
- [ ] Marker / rubric change
- [ ] Tooling (`.mjs`, `eval.sh`, `check.sh`)
- [ ] Docs
- [ ] CI

## Checks run

- [ ] `./scripts/check.sh`
- [ ] `node redteam/validate.mjs --strict`
- [ ] `node redteam/coverage.mjs`
- [ ] Dry run of the affected script (`--dry-run`)

## Reviewer notes

<!-- Anything that should not be trusted without reading: a changed severity, a new
marker that could false-positive, a case whose intent is hard to phrase neutrally. -->

## Content check

- [ ] No working patch, payload, offsets or step-by-step procedure was added
- [ ] No real personal data, keys or identifiers are included
- [ ] The case text would not let a reader act on it
