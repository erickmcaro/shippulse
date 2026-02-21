import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { getDb } from "../db.js";

const EVENTS_DIR = path.join(os.homedir(), ".openclaw", "shippulse");
const EVENTS_FILE = path.join(EVENTS_DIR, "events.jsonl");
const MAX_EVENTS_SIZE = 10 * 1024 * 1024; // 10MB

export type EventType =
  | "run.started" | "run.completed" | "run.failed" | "run.cancelled"
  | "run.share.clicked" | "run.share.copied"
  | "step.pending" | "step.running" | "step.done" | "step.failed" | "step.timeout" | "step.integrity" | "step.stuck"
  | "story.started" | "story.done" | "story.verified" | "story.retry" | "story.failed"
  | "pipeline.advanced";

export interface ShipPulseEvent {
  ts: string;
  event: EventType;
  runId: string;
  workflowId?: string;
  /** Human-readable step name (e.g. "plan", "implement"), NOT the internal UUID. */
  stepId?: string;
  agentId?: string;
  storyId?: string;
  storyTitle?: string;
  detail?: string;
}

type ParsedEventsCache = {
  mtimeMs: number;
  size: number;
  events: ShipPulseEvent[];
};

let parsedEventsCache: ParsedEventsCache | null = null;

function parseEventLine(line: string): ShipPulseEvent | null {
  if (!line) return null;
  try {
    return JSON.parse(line) as ShipPulseEvent;
  } catch {
    return null;
  }
}

function readAllEvents(): ShipPulseEvent[] {
  try {
    const stats = fs.statSync(EVENTS_FILE);
    if (
      parsedEventsCache &&
      parsedEventsCache.mtimeMs === stats.mtimeMs &&
      parsedEventsCache.size === stats.size
    ) {
      return parsedEventsCache.events;
    }

    const content = fs.readFileSync(EVENTS_FILE, "utf-8");
    const events = content
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(parseEventLine)
      .filter((evt): evt is ShipPulseEvent => evt !== null);

    parsedEventsCache = {
      mtimeMs: stats.mtimeMs,
      size: stats.size,
      events,
    };
    return events;
  } catch {
    parsedEventsCache = null;
    return [];
  }
}

export function emitEvent(evt: ShipPulseEvent): void {
  try {
    fs.mkdirSync(EVENTS_DIR, { recursive: true });
    // Rotate if too large
    try {
      const stats = fs.statSync(EVENTS_FILE);
      if (stats.size > MAX_EVENTS_SIZE) {
        const rotated = EVENTS_FILE + ".1";
        try { fs.unlinkSync(rotated); } catch {}
        fs.renameSync(EVENTS_FILE, rotated);
        parsedEventsCache = null;
      }
    } catch {}
    fs.appendFileSync(EVENTS_FILE, JSON.stringify(evt) + "\n");
    parsedEventsCache = null;
  } catch {
    // best-effort, never throw
  }
  fireWebhook(evt);
}

// In-memory cache: runId -> notify_url | null
const notifyUrlCache = new Map<string, string | null>();

function getNotifyUrl(runId: string): string | null {
  if (notifyUrlCache.has(runId)) return notifyUrlCache.get(runId)!;
  try {
    const db = getDb();
    const row = db.prepare("SELECT notify_url FROM runs WHERE id = ?").get(runId) as { notify_url: string | null } | undefined;
    const url = row?.notify_url ?? null;
    notifyUrlCache.set(runId, url);
    return url;
  } catch {
    return null;
  }
}

function fireWebhook(evt: ShipPulseEvent): void {
  const raw = getNotifyUrl(evt.runId);
  if (!raw) return;
  try {
    let url = raw;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const hashIdx = url.indexOf("#auth=");
    if (hashIdx !== -1) {
      headers["Authorization"] = decodeURIComponent(url.slice(hashIdx + 6));
      url = url.slice(0, hashIdx);
    }
    fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(evt),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  } catch {
    // fire-and-forget
  }
}

// Read recent events (last N)
export function getRecentEvents(limit = 50): ShipPulseEvent[] {
  const events = readAllEvents();
  return events.slice(-limit);
}

// Read events for a specific run (supports prefix match)
export function getRunEvents(runId: string, limit = 200): ShipPulseEvent[] {
  const query = runId.trim();
  if (!query) return [];
  const events = readAllEvents();
  const filtered = events.filter((evt) => evt.runId === query || evt.runId.startsWith(query));
  return filtered.slice(-limit);
}
