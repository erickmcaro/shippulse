import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveShipPulseRoot } from "../installer/paths.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getPidFile(): string {
  return path.join(resolveShipPulseRoot(), "dashboard.pid");
}

export function getLogFile(): string {
  return path.join(resolveShipPulseRoot(), "dashboard.log");
}

export function getPortFile(): string {
  return path.join(resolveShipPulseRoot(), "dashboard.port");
}

function parseStrictPositiveInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^[0-9]+$/.test(trimmed)) return null;
  const value = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(value) || value <= 0) return null;
  return value;
}

export function isRunning(): { running: true; pid: number } | { running: false } {
  const pidFile = getPidFile();
  if (!fs.existsSync(pidFile)) {
    try { fs.unlinkSync(getPortFile()); } catch {}
    return { running: false };
  }
  const pidText = fs.readFileSync(pidFile, "utf-8");
  const pid = parseStrictPositiveInt(pidText);
  if (pid === null) {
    try { fs.unlinkSync(pidFile); } catch {}
    try { fs.unlinkSync(getPortFile()); } catch {}
    return { running: false };
  }
  try {
    process.kill(pid, 0);
    return { running: true, pid };
  } catch {
    // Stale PID file
    try { fs.unlinkSync(pidFile); } catch {}
    try { fs.unlinkSync(getPortFile()); } catch {}
    return { running: false };
  }
}

export async function startDaemon(port = 3333): Promise<{ pid: number; port: number }> {
  const status = getDaemonStatus();
  if (status?.running && typeof status.pid === "number") {
    return { pid: status.pid, port: status.port ?? port };
  }

  const logFile = getLogFile();
  const pidDir = path.dirname(getPidFile());
  fs.mkdirSync(pidDir, { recursive: true });

  const out = fs.openSync(logFile, "a");
  const err = fs.openSync(logFile, "a");

  const daemonScript = path.resolve(__dirname, "daemon.js");
  const child = spawn(process.execPath, [daemonScript, String(port)], {
    detached: true,
    stdio: ["ignore", out, err],
  });
  child.unref();

  // Wait 1s then confirm
  await new Promise((r) => setTimeout(r, 1000));

  const check = isRunning();
  if (!check.running) {
    throw new Error("Daemon failed to start. Check " + logFile);
  }
  const latest = getDaemonStatus();
  return { pid: check.pid, port: latest?.port ?? port };
}

export function stopDaemon(): boolean {
  const status = isRunning();
  if (!status.running) return false;
  try {
    process.kill(status.pid, "SIGTERM");
  } catch {}
  try { fs.unlinkSync(getPidFile()); } catch {}
  try { fs.unlinkSync(getPortFile()); } catch {}
  return true;
}

export function getDaemonStatus(): { running: boolean; pid?: number; port?: number } | null {
  const status = isRunning();
  if (!status.running) return { running: false };
  let port: number | undefined;
  try {
    const parsed = parseStrictPositiveInt(fs.readFileSync(getPortFile(), "utf-8"));
    if (parsed !== null) {
      port = parsed;
    } else {
      try { fs.unlinkSync(getPortFile()); } catch {}
    }
  } catch {
    // best-effort metadata
  }
  return { running: true, pid: status.pid, port };
}
