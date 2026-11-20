# Changelog

All notable changes to this repository. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions are repository milestones rather than published packages.

## [Unreleased]

### Added
- `white/`, `gray/` and `black/`: rules of engagement, dual-use triage and adversary
  emulation planning, each with a README and a checkable `*.json`.
- `teams/check.mjs`: fails when gray invents a category, black cites a technique blue does
  not cover, or white points at a rubric that does not exist.
- `typescript` and `@types/node` as dev-only dependencies, with `npm run typecheck`.
- `tsconfig.strict.json`: strict mode applied module by module (`classify.mjs`,
  `validate-cases.mjs`, `coverage-lib.mjs` today).
- Unit tests for the case validator, the coverage rule, the blue-team pairing rule and the
  colour-team gate, plus coverage reported in CI.

### Changed
- CI installs dev dependencies and runs both typecheck configs before the tests.

## [0.7.0] - 2026-11-20

### Added
- `redteam/eval.sh`: one command that maps a provider to its base URL and key variable,
  then runs, scores, reports and optionally judges.
- `redteam/RUNNING.md`: provider table with exact variable names, output files and
  troubleshooting.

## [0.6.0] - 2026-11-20

### Added
- `redteam/tools.json`: 42 tools with real name, listed name, licence status and aliases.
- `redteam/coverage.mjs`: fails when a tool has no case, a case never names its tool, or a
  per-tool case has no inventory entry.
- `RT-TOOLP-036` … `042`: per-tool cases for IDA Pro, Cobalt Strike, Core Impact, Sliver,
  Mythic, Scapy and Bettercap.

## [0.5.0] - 2026-11-20

### Added
- `docs/pentesting-roadmap.md`: 12-week lab-based learning path with authorisation and
  consent rules, plus a six-week Frida/Objection mobile module.
- `redteam/inventory.md`: licence status and eval coverage for every listed tool.
- `redteam/NOTICE.md`: educational/testing-only scope and the authorisation rule.

## [0.4.0] - 2026-11-20

### Added
- `redteam/validate.mjs`: schema and semantic gate for the case file.
- `redteam/classify.mjs`: single source of truth for verdicts.
- `redteam/judge.mjs`: LLM-as-judge pass with marker agreement reporting.
- `redteam/report.mjs`: Markdown report across one or more results files.
- Multi-turn support in `run.mjs`, with two escalation cases.
- `.github/workflows/redteam.yml` and `scripts/check.sh`.

### Changed
- `score.mjs` now imports the shared classifier.

## [0.3.0] - 2026-11-20

### Added
- `redteam/run.mjs`: runner for any OpenAI-compatible endpoint.
- Root `README.md`, `.gitignore`.

## [0.2.0] - 2026-11-20

### Added
- `redteam/`: 10 initial cases, `rubric.md`, `score.mjs`, sample results.

## [0.1.0] - 2026-11-20

### Added
- `Prompt` and `update prompt`: the raw transcript, preserved as evidence.
