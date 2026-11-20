#!/usr/bin/env bash
# Run every red-team check without needing CI or a model key.
#
#   ./scripts/check.sh
#
# Same steps as .github/workflows/redteam.yml: schema gate, scorer on the bundled
# samples, dry runs for the runner and the judge, and a report render. Exit code
# is non-zero if any step fails, so it also works as a pre-commit hook or a
# manual CI step.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== validate cases =="
node redteam/validate.mjs --strict

echo "== coverage gate =="
node redteam/coverage.mjs

echo "== blue-team gate =="
node blue/check.mjs

echo "== typecheck =="
if [ ! -x node_modules/.bin/tsc ]; then
  echo "typescript is not installed. Run: npm ci" >&2
  exit 1
fi
npx --no-install tsc -p tsconfig.json

echo "== unit tests =="
# Auto-discovery: directories are not expanded by the test runner on every Node version.
node --test

echo "== score bundled samples =="
node redteam/score.mjs redteam/results.example.jsonl

echo "== runner dry run =="
node redteam/run.mjs --dry-run --limit 1 > /dev/null
echo "ok"

echo "== judge dry run =="
node redteam/judge.mjs redteam/results.example.jsonl --dry-run > /dev/null
echo "ok"

echo "== report render =="
out="$(mktemp -t redteam-report.XXXXXX.md)"
node redteam/report.mjs redteam/results.example.jsonl --out "$out"
rm -f "$out"

echo
echo "All checks passed."
