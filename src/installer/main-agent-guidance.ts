import fs from "node:fs/promises";
import path from "node:path";
import { readOpenClawConfig } from "./openclaw-config.js";
import { resolveOpenClawStateDir, resolveShipPulseCli } from "./paths.js";

const WORKFLOW_BLOCK_START = "<!-- shippulse:workflows -->";
const WORKFLOW_BLOCK_END = "<!-- /shippulse:workflows -->";

function buildToolsBlock(cli: string): string {
  return `${WORKFLOW_BLOCK_START}
# ShipPulse Workflows

ShipPulse CLI (always use full path to avoid PATH issues):
\`${cli}\`

Commands:
- Install: \`${cli} workflow install <name>\`
- Run: \`${cli} workflow run <workflow-id> "<task>"\`
- Status: \`${cli} workflow status "<task title>"\`
- Logs: \`${cli} logs\`

Workflows are self-advancing via per-agent cron jobs. No manual orchestration needed.
${WORKFLOW_BLOCK_END}
`;
}

function buildAgentsBlock(cli: string): string {
  return `${WORKFLOW_BLOCK_START}
# ShipPulse Workflow Policy

## Installing Workflows
Run: \`${cli} workflow install <name>\`
Agent cron jobs are created automatically during install.

## Running Workflows
- Start: \`${cli} workflow run <workflow-id> "<task>"\`
- Status: \`${cli} workflow status "<task title>"\`
- Workflows self-advance via agent cron jobs polling SQLite for pending steps.
${WORKFLOW_BLOCK_END}
`;
}

function removeBlock(content: string): string {
  let next = content;
  while (true) {
    const start = next.indexOf(WORKFLOW_BLOCK_START);
    const firstEnd = next.indexOf(WORKFLOW_BLOCK_END);
    if (start === -1 && firstEnd === -1) break;
    if (firstEnd !== -1 && (start === -1 || firstEnd < start)) {
      // Broken leading end marker without a matching start marker.
      const beforeText = next.slice(0, firstEnd).trimEnd();
      const afterText = next.slice(firstEnd + WORKFLOW_BLOCK_END.length).trimStart();
      if (!beforeText) {
        next = afterText ? `${afterText}\n` : "";
      } else if (!afterText) {
        next = `${beforeText}\n`;
      } else {
        next = `${beforeText}\n\n${afterText}\n`;
      }
      continue;
    }
    if (start === -1) break;
    const end = next.indexOf(WORKFLOW_BLOCK_END, start + WORKFLOW_BLOCK_START.length);
    if (end === -1) {
      // Broken trailing block (missing closing marker): drop from marker to EOF
      // so a clean block can be reinserted.
      const beforeText = next.slice(0, start).trimEnd();
      next = beforeText ? `${beforeText}\n` : "";
      break;
    }
    const after = end + WORKFLOW_BLOCK_END.length;
    const beforeText = next.slice(0, start).trimEnd();
    const afterText = next.slice(after).trimStart();
    if (!beforeText) {
      next = afterText ? `${afterText}\n` : "";
      continue;
    }
    if (!afterText) {
      next = `${beforeText}\n`;
      continue;
    }
    next = `${beforeText}\n\n${afterText}\n`;
  }
  return next;
}

function upsertBlock(content: string, block: string): string {
  const cleaned = removeBlock(content);
  if (!cleaned.trim()) return `${block}\n`;
  return `${cleaned.trimEnd()}\n\n${block}\n`;
}

async function readFileOrEmpty(filePath: string): Promise<string> {
  try { return await fs.readFile(filePath, "utf-8"); } catch { return ""; }
}

function resolveMainAgentWorkspacePath(cfg: { agents?: { defaults?: { workspace?: string } } }) {
  const workspace = cfg.agents?.defaults?.workspace?.trim();
  if (workspace) return workspace;
  return path.join(resolveOpenClawStateDir(), "workspace");
}

export async function updateMainAgentGuidance(): Promise<void> {
  const { config } = await readOpenClawConfig();
  const workspaceDir = resolveMainAgentWorkspacePath(config as { agents?: { defaults?: { workspace?: string } } });
  const cli = `node "${resolveShipPulseCli()}"`;
  const toolsPath = path.join(workspaceDir, "TOOLS.md");
  const agentsPath = path.join(workspaceDir, "AGENTS.md");

  const toolsContent = await readFileOrEmpty(toolsPath);
  const agentsContent = await readFileOrEmpty(agentsPath);

  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.writeFile(toolsPath, upsertBlock(toolsContent, buildToolsBlock(cli)), "utf-8");
  await fs.writeFile(agentsPath, upsertBlock(agentsContent, buildAgentsBlock(cli)), "utf-8");
}

export async function removeMainAgentGuidance(): Promise<void> {
  const { config } = await readOpenClawConfig();
  const workspaceDir = resolveMainAgentWorkspacePath(config as { agents?: { defaults?: { workspace?: string } } });
  const toolsPath = path.join(workspaceDir, "TOOLS.md");
  const agentsPath = path.join(workspaceDir, "AGENTS.md");

  const toolsContent = await readFileOrEmpty(toolsPath);
  const agentsContent = await readFileOrEmpty(agentsPath);

  if (toolsContent) await fs.writeFile(toolsPath, removeBlock(toolsContent), "utf-8");
  if (agentsContent) await fs.writeFile(agentsPath, removeBlock(agentsContent), "utf-8");
}
