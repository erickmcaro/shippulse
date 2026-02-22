#!/usr/bin/env bash
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${PATH}"
CLAUDE_BIN="/Users/erickcaro/.local/bin/claude"

REPO=""
GOAL=""
MODE="reliability"
MODEL="sonnet"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --goal) GOAL="$2"; shift 2 ;;
    --mode) MODE="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ -z "$REPO" || -z "$GOAL" ]]; then
  echo "Usage: $0 --repo /abs/path --goal \"text\" [--mode reliability|shipping] [--model sonnet|opus|...]"
  exit 2
fi

if [[ ! -d "$REPO" ]]; then
  echo "Repo not found: $REPO"
  exit 2
fi

if [[ ! -x "$CLAUDE_BIN" ]]; then
  echo "claude CLI not found at $CLAUDE_BIN"
  exit 2
fi

if [[ "$MODE" == "shipping" ]]; then
  AGENTS='{
    "planner": {"description": "Plans milestones and implementation order", "prompt": "You are a senior technical planner. Break work into small verifiable increments."},
    "implementer": {"description": "Implements code changes", "prompt": "You are a senior software engineer. Make minimal safe changes and add tests."},
    "reviewer": {"description": "Reviews correctness and risk", "prompt": "You are a strict reviewer. Check edge cases, regressions, and maintainability."}
  }'
else
  AGENTS='{
    "planner": {"description": "Plans milestones and implementation order", "prompt": "You are a senior technical planner. Break work into small verifiable increments."},
    "implementer": {"description": "Implements code changes", "prompt": "You are a senior software engineer. Make minimal safe changes and add tests."},
    "verifier": {"description": "Validates outcomes with tests", "prompt": "You are a reliability verifier. Run and interpret tests, prioritize deterministic checks."},
    "reviewer": {"description": "Reviews correctness and risk", "prompt": "You are a strict reviewer. Check edge cases, regressions, and maintainability."}
  }'
fi

mkdir -p "$REPO/.claude/team-runs"
OUT="$REPO/.claude/team-runs/$(date +%Y%m%d-%H%M%S)-$MODE.md"

PROMPT=$(printf '%s\n' \
"Goal: $GOAL" \
"" \
"Operate as a coordinated team using the provided custom agents." \
"Workflow:" \
"1) planner proposes a step plan" \
"2) implementer performs smallest safe increment" \
"3) verifier runs/requests tests and confirms criteria" \
"4) reviewer checks risk and final quality" \
"" \
"Repository: $REPO" \
"Requirements:" \
"- Prefer reliability over speed." \
"- Add or update tests for behavior changes." \
"- Report: PLAN, CHANGES, TEST RESULTS, RISKS, NEXT STEP.")

cd "$REPO"
"$CLAUDE_BIN" -p --model "$MODEL" --agents "$AGENTS" "$PROMPT" | tee "$OUT"
echo "Saved: $OUT"
