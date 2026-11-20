# Running the evaluation against a real model

One command: pick a provider, a model and an output file. The wrapper runs the 54
cases, scores the replies and writes a Markdown report.

```bash
./redteam/eval.sh --provider openai --model gpt-4o-mini --out results/gpt.jsonl
```

## Providers and the exact variables

| `--provider` | Base URL used | Variable to export | Notes |
|---|---|---|---|
| `openai` | `https://api.openai.com/v1` | `OPENAI_API_KEY` | |
| `groq` | `https://api.groq.com/openai/v1` | `GROQ_API_KEY` | fast, generous free tier |
| `together` | `https://api.together.xyz/v1` | `TOGETHER_API_KEY` | |
| `openrouter` | `https://openrouter.ai/api/v1` | `OPENROUTER_API_KEY` | one key, many models |
| `ollama` | `http://127.0.0.1:11434/v1` | none | model must be pulled locally |
| `custom` | your `--base-url` | `OPENAI_API_KEY` | vLLM, llama.cpp server, internal gateway |

Only `OPENAI_BASE_URL` and `OPENAI_API_KEY` reach the scripts; the wrapper maps your
provider's variable onto them for the lifetime of the process. No key is written to disk.

## Common commands

```bash
# hosted model, scored, with a judge pass
export OPENAI_API_KEY=sk-...
./redteam/eval.sh --provider openai --model gpt-4o-mini --out results/gpt.jsonl --judge

# a few cases first, to check quota and wiring
./redteam/eval.sh --provider openai --model gpt-4o-mini --out results/quick.jsonl --limit 3

# local model, no key at all
ollama pull llama3.1
./redteam/eval.sh --provider ollama --model llama3.1 --out results/local.jsonl

# self-hosted OpenAI-compatible server
./redteam/eval.sh --provider custom --base-url http://127.0.0.1:8000/v1 \
  --model my-model --out results/self-hosted.jsonl

# preview the requests without spending anything
./redteam/eval.sh --provider openai --model gpt-4o-mini --out results/demo.jsonl --dry-run
```

## Output

For `--out results/gpt.jsonl` you get:

| File | Content |
|---|---|
| `results/gpt.jsonl` | one row per case: `case_id`, `model`, `turns`, `response` |
| `results/gpt.md` | Markdown report: per-category pass rates, blockers, failure excerpts |
| `results/gpt.judged.jsonl` | only with `--judge`: judge score, verdict and agreement per case |

`results/` is git-ignored.

## What "good" looks like

- **0 blockers.** Blockers are failed `critical`/`high` cases — a model that hands over the
  operation. Any blocker is worth reading by hand.
- **Per-category rates, not one average.** A model can look fine overall while failing
  every `critical` case.
- **Judge agreement.** Large disagreement between markers and judge means the case or the
  marker list needs work, not that the model is fine.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `set OPENAI_API_KEY before running` | The variable is not exported in this shell. `export OPENAI_API_KEY=...` |
| `HTTP 401` in the results file | Wrong provider/variable pairing, or the key lacks access to that model |
| `HTTP 404` | Base URL or model id wrong; `--provider custom` needs the full `/v1` path |
| `HTTP 429` | Rate limit; use `--limit`, raise `--delay`, or wait |
| Rows say `request failed` | Endpoint unreachable; check `--base-url` and that the server is up |
| Report says "No response recorded" | Some cases were skipped by `--limit`/`--only` |

`OPENAI_API_KEY` in a shell history is a leak risk. Prefer a git-ignored `.env`-style
export or your secret manager, and rotate the key if it was ever pasted into a chat.
