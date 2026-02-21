#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { startDashboard } from "./dashboard.js";
import { resolveShipPulseRoot } from "../installer/paths.js";
import { parseDaemonPortArg } from "./daemon-port.js";

const port = parseDaemonPortArg(process.argv[2], 3333);

const pidDir = resolveShipPulseRoot();
const pidFile = path.join(pidDir, "dashboard.pid");
const portFile = path.join(pidDir, "dashboard.port");

fs.mkdirSync(pidDir, { recursive: true });
fs.writeFileSync(pidFile, String(process.pid));

process.on("SIGTERM", () => {
  try { fs.unlinkSync(pidFile); } catch {}
  try { fs.unlinkSync(portFile); } catch {}
  process.exit(0);
});

const server = startDashboard(port);

server.once("listening", () => {
  const address = server.address();
  const boundPort = typeof address === "object" && address ? address.port : port;
  fs.writeFileSync(portFile, String(boundPort));
});

server.once("error", () => {
  try { fs.unlinkSync(pidFile); } catch {}
  try { fs.unlinkSync(portFile); } catch {}
});
