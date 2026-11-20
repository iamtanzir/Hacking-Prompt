#!/usr/bin/env bash
# Run the whole evaluation against one real model, in one command.
#
#   OPENAI_API_KEY=... ./redteam/eval.sh --provider openai --model gpt-4o-mini --out results/gpt.jsonl
#   GROQ_API_KEY=...   ./redteam/eval.sh --provider groq --model llama-3.3-70b-versatile --out results/llama.jsonl --judge
#   ./redteam/eval.sh --provider ollama --model llama3.1 --out results/local.jsonl
#
# Steps: run the cases -> score them -> render a Markdown report -> optionally judge.
# Keys are read from the environment and forwarded as OPENAI_API_KEY for the duration
# of this process; nothing is written to disk.
set -euo pipefail

cd "$(dirname "$0")/.."

usage() {
  cat <<'USAGE'
usage: ./redteam/eval.sh --provider <name> --model <model> [options]

  --provider   openai | groq | together | openrouter | ollama | custom
  --model      model id at that provider (required)
  --out        results file, default results/<timestamp>.jsonl
  --base-url   override the provider's base URL (required for custom)
  --limit      send only the first N cases
  --only       comma-separated case ids
  --delay      ms between requests, default 250
  --judge      also run the LLM-as-judge pass with the same model
  --dry-run    print requests, send nothing
  -h, --help   this text

Keys (export before running):
  openai OPENAI_API_KEY | groq GROQ_API_KEY | together TOGETHER_API_KEY
  openrouter OPENROUTER_API_KEY | custom OPENAI_API_KEY | ollama none
USAGE
}

provider="" model="" out="" base_url="" limit="" only="" delay="" judge=0 dry_run=0

while [ $# -gt 0 ]; do
  case "$1" in
    --provider) provider="${2:-}"; shift 2 ;;
    --model)    model="${2:-}"; shift 2 ;;
    --out)      out="${2:-}"; shift 2 ;;
    --base-url) base_url="${2:-}"; shift 2 ;;
    --limit)    limit="${2:-}"; shift 2 ;;
    --only)     only="${2:-}"; shift 2 ;;
    --delay)    delay="${2:-}"; shift 2 ;;
    --judge)    judge=1; shift ;;
    --dry-run)  dry_run=1; shift ;;
    -h|--help)  usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done

case "$provider" in
  openai)     default_base="https://api.openai.com/v1";      keyvar="OPENAI_API_KEY" ;;
  groq)       default_base="https://api.groq.com/openai/v1"; keyvar="GROQ_API_KEY" ;;
  together)   default_base="https://api.together.xyz/v1";    keyvar="TOGETHER_API_KEY" ;;
  openrouter) default_base="https://openrouter.ai/api/v1";   keyvar="OPENROUTER_API_KEY" ;;
  ollama)     default_base="http://127.0.0.1:11434/v1";      keyvar="" ;;
  custom)     default_base="";                               keyvar="OPENAI_API_KEY" ;;
  "")
    echo "--provider is required" >&2; usage; exit 2 ;;
  *)
    echo "unknown provider: $provider" >&2; usage; exit 2 ;;
esac

[ -n "$model" ] || { echo "--model is required" >&2; exit 2; }
base_url="${base_url:-$default_base}"
[ -n "$base_url" ] || { echo "--base-url is required for provider custom" >&2; exit 2; }
[ -n "$out" ] || out="results/$(date +%Y%m%d-%H%M%S).jsonl"
mkdir -p "$(dirname "$out")"

export OPENAI_BASE_URL="$base_url"

if [ -n "$keyvar" ] && [ "$dry_run" -eq 0 ]; then
  key_value="${!keyvar:-}"
  if [ -z "$key_value" ]; then
    echo "set $keyvar before running provider $provider" >&2
    echo "example: $keyvar=sk-... ./redteam/eval.sh --provider $provider --model $model --out $out" >&2
    exit 2
  fi
  export OPENAI_API_KEY="$key_value"
fi

args=(--model "$model" --out "$out")
[ -n "$limit" ] && args+=(--limit "$limit")
[ -n "$only" ] && args+=(--only "$only")
[ -n "$delay" ] && args+=(--delay "$delay")
[ "$dry_run" -eq 1 ] && args+=(--dry-run)

echo "== run: $model via $provider ($base_url) =="
node redteam/run.mjs "${args[@]}"

if [ "$dry_run" -eq 1 ]; then
  exit 0
fi

echo
echo "== score =="
node redteam/score.mjs "$out" || true

report="${out%.jsonl}.md"
echo
echo "== report =="
node redteam/report.mjs "$out" --out "$report" --title "Red-team report — $model" || true

if [ "$judge" -eq 1 ]; then
  judged="${out%.jsonl}.judged.jsonl"
  echo
  echo "== judge =="
  if node redteam/judge.mjs "$out" --model "$model" --out "$judged"; then
    echo "judge agreed with the markers"
  else
    echo "judge flagged at least one reply the markers passed — read $judged" >&2
  fi
fi

echo
echo "results: $out"
echo "report:  $report"
