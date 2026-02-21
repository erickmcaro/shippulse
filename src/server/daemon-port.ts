export function parseDaemonPortArg(raw: string | undefined, fallback = 3333): number {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!/^[0-9]+$/.test(trimmed)) return fallback;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 65535) return fallback;
  return parsed;
}
