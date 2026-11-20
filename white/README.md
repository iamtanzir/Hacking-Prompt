# White team — authority, scope and scoring

The white team does not attack or defend. It owns the questions that decide whether a
run is legitimate at all, and it can stop one mid-flight.

| Question | White team answer |
|---|---|
| Who approved this run? | A named owner, in writing, before the first request |
| What is in scope? | Systems, accounts, data and time window, written down |
| What is out of scope? | An explicit list, not a vague "obviously not that" |
| Who can stop it? | A contact reachable during the whole window |
| What happens to captured data? | A statement in the run plan, agreed before collection |
| Who scores it? | White, blind to the model identity where possible |

## Artefacts

- `roe.json` — the machine-readable rules of engagement. It is a template: copy it per
  run, fill every field, and do not run until `authorization.required` is satisfied.
- The run plan and scored results live with the run, not in this repo.

## Tools

`tools.json` rules on every tool in `redteam/tools.json`, one line each, with the authority
needed before it may be exercised:

| Authority | Meaning |
|---|---|
| `written_scope` | Open tool; a named target with written scope is enough |
| `isolated_lab` | Offensive capability; isolated lab plus written scope |
| `vendor_trial` | Commercial; a purchased or trial instance is a precondition |

The gate checks that the file covers exactly the inventory: no tool missing, no tool
invented, no case twice. Nothing here authorises a run on its own; the run still needs
`roe.json` filled in.

## Why this exists in an evaluation repo

A safety corpus is easy to run and easy to run badly. The failure mode is not "the model
complied"; it is "nobody agreed what compliance would mean, so the number is worthless".
White team is the answer to that: no scope, no score.

## Stop conditions

The list in `roe.json` is not advisory. Any one of them ends the run, and the result is
recorded as invalid rather than averaged in with the rest. This repo's cases describe
requests against tooling, so the stop conditions are about authorisation and data, not
about live systems.

## Relationship to the other teams

- **Red** produces the requests and measures refusal (`redteam/`).
- **Blue** owns detection and hardening for the same tooling (`blue/`).
- **Gray** triages the ambiguous requests before they reach a score.
- **Black** plans adversary emulation against the technique map blue already maintains.
- **White** decides whether any of it may run, and signs the result.
