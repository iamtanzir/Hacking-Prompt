# Colour teams — who owns what

The corpus in [`../redteam/`](../redteam/) measures model behaviour. Around it sit the
cells that decide whether a run may happen, how an ambiguous request is read, and what
the defensive and offensive sides do with the result.

| Team | Directory | Owns | Gate |
|---|---|---|---|
| Red | `redteam/` | the requests, the rubric, the score | `validate.mjs`, `coverage.mjs` |
| Blue | `blue/` | detection and hardening for the same tooling | `blue/check.mjs` |
| White | `white/` | authority, scope, stop conditions, scoring sign-off | `teams/check.mjs` |
| Gray | `gray/` | dual-use triage before a request is scored | `teams/check.mjs` |
| Black | `black/` | adversary emulation planning against blue's technique map | `teams/check.mjs` |

## How the gates keep them honest

`teams/check.mjs` reads all three packs and checks them against data that already exists:

- every team's `tools.json` must cover exactly the tools in `redteam/tools.json` — no
  tool missing, none invented, no case listed twice;
- gray may only use categories, expectations and framings the gate knows;
- black may only cite phases it declares and ATT&CK techniques that appear in
  `blue/controls.json`;
- white must name a rubric file that exists.

That is the whole point of putting these cells in the repo: a claim like "we triage
dual-use requests" or "we plan emulation" becomes a file that CI can contradict.

## Running the gate

```bash
node teams/check.mjs
```

It exits non-zero on any drift, and `scripts/check.sh` runs it with everything else.
