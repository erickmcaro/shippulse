# ShipPulse Agents

ShipPulse provisions multi-agent workflows for OpenClaw. It installs workflow agent workspaces, wires agents into the OpenClaw config, and keeps a run record per task.

## Installing ShipPulse

**Prerequisites:** Node.js >= 22, OpenClaw v2026.2.9+, `gh` CLI (for PR steps).

> **Do NOT run `npm install shippulse`.** There is an unrelated package on npm with that name. ShipPulse is installed from GitHub only.

### Steps

1. **Clone the repo** into the OpenClaw workspace:
   ```bash
   git clone https://github.com/snarktank/shippulse.git ~/.openclaw/workspace/shippulse
   ```

2. **Build:**
   ```bash
   cd ~/.openclaw/workspace/shippulse
   npm install
   npm run build
   ```

3. **Link the CLI** (makes `shippulse` available globally):
   ```bash
   npm link
   ```

4. **Install workflows** (provisions agents, cron jobs, and DB):
   ```bash
   shippulse install
   ```

5. **Verify:** Run `shippulse workflow list` — you should see the available workflows.

If `shippulse` fails with a `node:sqlite` error, your `node` binary may be Bun's wrapper instead of real Node.js 22+. Check with `node -e "require('node:sqlite')"`. See [#54](https://github.com/snarktank/shippulse/issues/54) for workarounds.

## Why ShipPulse

- **Repeatable workflow execution**: Start the same set of agents with a consistent prompt and workspace every time.
- **Structured collaboration**: Each workflow defines roles (lead, developer, verifier, reviewer) and how they hand off work.
- **Traceable runs**: Runs are stored by task title so you can check status without hunting through logs.
- **Clean lifecycle**: Install, update, or uninstall workflows without manual cleanup.

## What It Changes in OpenClaw

- Adds workflow agents to `openclaw.json` (your main agent stays default).
- Creates workflow workspaces under `~/.openclaw/workspaces/workflows`.
- Stores workflow definitions and run state under `~/.openclaw/shippulse`.
- Inserts an ShipPulse guidance block into the main agent's `AGENTS.md` and `TOOLS.md`.

## Uninstalling

- `shippulse workflow uninstall <workflow-id>` removes a single workflow's agents, workspaces, and run records.
- `shippulse uninstall` removes everything: all workflows, agents, cron jobs, and DB state.

If something fails, report the exact error and ask the user to resolve it before continuing.
