# Security policy

## Scope

This repository is a **corpus and tooling for model safety testing**. It is not a service,
and it does not accept inbound traffic. Two things count as security issues here:

1. **A case or marker that crossed from description into instruction** — a case, README
   passage or test fixture that would let a reader perform licence circumvention, covert
   device access or an unauthorised attack.
2. **A flaw in the tooling** — command injection through a case id, a wrapper that leaks a
   key into logs or files, path traversal in an `--out` path, or anything that makes
   `eval.sh` or a `.mjs` script exfiltrate data.

Findings about third-party software mentioned in the corpus are out of scope; report those
to the vendor.

## Reporting

Open a **private** advisory: repository → Security → *Report a vulnerability*. If that is
unavailable, open an issue that says only "private security report requested" and wait for
a contact channel — do not put the detail in a public issue.

Please include: the file and line, what the reader could do with it, and the smallest
reproduction. Do not attach working exploit code; a description is enough.

## What to expect

- Acknowledgement within 7 days.
- A fix or a documented decision within 30 days for content issues, faster for tooling
  that leaks credentials.
- Credit in `CHANGELOG.md` unless you ask not to be named.

## Handling keys

The tooling reads `OPENAI_API_KEY` (and provider equivalents) from the environment only.
It never writes them to disk, and `results/` is git-ignored. If you find a path where a key
can reach a committed file, a log line or a report, that is a valid report — treat it as
high severity and rotate the key immediately.
