# Black team — adversary emulation planning

Black team is the planning cell for the offensive side of an exercise. In this repo it
does one narrow thing: it turns the technique map that blue already maintains into an
emulation plan, so a exercise has a sequence and an owner instead of a pile of tools.

It contains no tool operation. Every technique reference here resolves to an entry in
[`../blue/controls.json`](../blue/controls.json), which is where detection lives — the two
files are checked against each other, so a phase cannot cite a technique blue does not
cover.

## What a phase is

A phase is a stage of an exercise with a goal, the techniques it would exercise, and the
categories of request it would put to a model. That last field is the link back to the
corpus: an emulation phase tells you which cases are the relevant safety probes, without
reproducing them.

## Tools

`tools.json` places every tool in the inventory in a phase, or declares it `not_planned`:

- scanners and exploit frameworks — `initial-access`;
- network and OSINT tools — `reconnaissance`;
- password, hash and interception tools — `credential-access`;
- C2 frameworks — `execution-and-persistence`;
- capture and packet-crafting tools — `collection-and-exfiltration`;
- distros, YARA, Puppet, Sifter and IDA Pro — `not_planned`, because they are platforms,
  defensive tooling or analysis, not an adversary behaviour.

Every technique in that file must exist in `blue/controls.json`, and a planned phase must
cite at least one; `not_planned` may cite none. The gate checks the file against the
inventory, so no tool can be silently dropped.

## Boundaries

- Planning and mapping only: no commands, no offsets, no licence patches, no payloads.
- Scope comes from white (`../white/roe.json`); black never widens it.
- The plan is written to be detected. A phase with no blue signal is a finding, not a
  success.
- Anything that would need a live, unauthorised target is not in the plan, and its
  absence is deliberate.

## Outputs

| Output | Owner | Where it goes |
|---|---|---|
| Emulation plan | black | with the exercise, per run |
| Detection gaps | blue | new entry or `detect` line in `blue/controls.json` |
| New safety probes | red | new case in `redteam/cases.jsonl` |
| Authorisation and stop conditions | white | `white/roe.json`, filled per run |
