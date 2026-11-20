# Blue team — detection and hardening for the same corpus

The red-team side measures whether a model refuses. This side answers the other
question: if the same tool were used against you, what would you see and what would
stop it?

`controls.json` has one entry per tool in [`../redteam/tools.json`](../redteam/tools.json), so
the two lists cannot drift apart. Each entry carries:

| Field | Meaning |
|---|---|
| `tool` | Tool name, matching the inventory |
| `case` | The red-team case that tests the corresponding request |
| `licenceGated` | Whether the product is paid; changes the defensive priority |
| `detect` | Concrete signals to look for in logs, EDR or network telemetry |
| `harden` | Controls that make the technique fail or stand out |
| `mitre` | ATT&CK technique ids this maps to |
| `note` | How to read the entry given the tool's licence status |

## What "coverage" means here

Every inventoried tool has an entry — that is enforced, not aspirational:

```bash
node blue/check.mjs
```

The check fails when a tool has no control, when a control names a tool that is not in the
inventory, or when an entry is missing detection, hardening or ATT&CK mapping. The same gate
runs in `scripts/check.sh` and CI.

## Priorities that actually reduce risk

1. **Identity before tooling.** Most of the techniques in this corpus end with credential
   use. Phishing-resistant MFA and a tiered admin model remove more risk than any single
   detection rule.
2. **Egress control.** Beacons, OOB callbacks and exfiltration all need outbound traffic.
   An allowlist with inspection beats a perfect signature that only fires sometimes.
3. **Patching beats detecting.** Parameterised queries, code-signature verification and
   current vendor builds make the whole class of request pointless.
4. **Licence integrity is a control too.** A patched commercial tool on your estate is both
   a legal exposure and an unmanaged binary; alert on it rather than tolerate it.
5. **Instrument your own estate first.** A detection rule you have never seen fire is a
   guess. Run log-only, measure noise, then enforce.

## The mobile case

The mobile cases (`RT-MOB-*`) map to platform controls rather than a tool entry:

| Signal | Control |
|---|---|
| Accessibility service enabled by a non-accessible app | Play Protect scanning, enterprise app allowlist, alert on service registration |
| Device admin granted to an unknown app | Block installs outside the managed store, alert on admin grants |
| Persistent notification suppressed or missing | Treat a background service with no user-visible indicator as suspicious |
| Configuration profile installed manually (iOS) | Require supervision; restrict profile installation by policy |
| Pinned traffic suddenly readable through a proxy | Investigate the proxy CA in the device trust store |

## Rules

`rules/javaagent-load.yml` is a Sigma example for the licence-patcher technique used
throughout the transcript. It is deliberately small and comes with tuning notes: start in
log-only mode, collect your real approved agent paths, then enforce. An example rule is a
starting point, not a product.

## Reporting

If you use these entries in a report, cite the ATT&CK mapping and say which signal you
actually have telemetry for. "Detection available" without a log source is a guess, and
guesses in a security report are worse than gaps.
