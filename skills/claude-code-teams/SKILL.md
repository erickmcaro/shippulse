---
name: claude-code-teams
description: Run Claude Code with custom team roles (planner, implementer, verifier, reviewer) using `claude --agents` for autonomous coding loops. Use when you want multi-role Claude Code execution on a repo, especially reliability hardening, E2E validation, and iterative fixes.
---

# Claude Code Teams

Use this skill to run a reproducible Claude Code team loop from the terminal.

## Required
- `claude` CLI installed and authenticated
- Trusted git repo working directory

## Team launcher
Use the bundled script:

```bash
scripts/run-team.sh \
  --repo /absolute/path/to/repo \
  --goal "Your objective" \
  --mode reliability
```

Modes:
- `reliability` (default): planner + implementer + verifier + reviewer
- `shipping`: planner + implementer + reviewer

## What it does
1. Changes to `--repo`
2. Builds a Claude `--agents` JSON team
3. Runs `claude -p` non-interactively with that team
4. Writes output log to `.claude/team-runs/<timestamp>.md`

## Suggested workflow
1. Run once with a focused goal
2. Apply changes / inspect output
3. Run tests + e2e
4. Re-run with narrowed follow-up goal

## Example for CaroBot reliability

```bash
scripts/run-team.sh \
  --repo /Users/Shared/projects2026/CaroBot \
  --goal "Improve reliability for ShipPulse-driven autonomous delivery; add tests and remove flaky behavior" \
  --mode reliability
```

## Notes
- Keep goals specific and measurable.
- Prefer small loops over one giant run.
- If you need persistent session behavior, remove `-p` in the script and run interactively.
