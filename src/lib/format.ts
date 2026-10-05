// Formatting helpers. All money is Nigerian naira.

/** Compact naira: ₦52k, ₦1.2m. Use engine's `naira()` for exact amounts. */
export function money(ngn: number): string {
  const abs = Math.abs(ngn);
  if (abs >= 1e9) return `₦${trim(ngn / 1e9)}bn`;
  if (abs >= 1e6) return `₦${trim(ngn / 1e6)}m`;
  if (abs >= 1e3) return `₦${trim(ngn / 1e3)}k`;
  return `₦${Math.round(ngn)}`;
}

function trim(n: number) {
  return n >= 100 ? Math.round(n).toString() : n.toFixed(n >= 10 ? 1 : 2).replace(/\.?0+$/, "");
}

export function pct(n: number, digits = 1) {
  return `${(n * 100).toFixed(digits)}%`;
}

export function duration(mins: number) {
  if (mins < 1) return `${Math.max(1, Math.round(mins * 60))}s`;
  if (mins < 60) return `${mins < 10 ? mins.toFixed(1).replace(/\.0$/, "") : Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function ago(iso: string, now = Date.now()) {
  const s = (now - new Date(iso).getTime()) / 1000;
  if (s < 0) return inFuture(-s);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function inFuture(s: number) {
  if (s < 3600) return `in ${Math.max(1, Math.round(s / 60))}m`;
  if (s < 86400) return `in ${Math.round(s / 3600)}h`;
  return `in ${Math.round(s / 86400)}d`;
}

export function dateTime(iso: string, tz = "Africa/Lagos") {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeOnly(iso: string, tz?: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
}

export function dateOnly(iso: string, tz?: string) {
  return new Date(iso).toLocaleDateString("en-GB", { timeZone: tz, day: "numeric", month: "short", year: "numeric" });
}

/** Hour of day (0-23) for an instant in a given IANA zone. */
export function localHour(date: Date, tz: string) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(date));
}

/** Short city label for a zone, e.g. "Europe/London" -> "London". */
export function tzLabel(tz: string) {
  return tz.split("/").pop()!.replace(/_/g, " ");
}

/** Offset of a zone relative to UTC in minutes at a given instant. */
export function tzOffsetMins(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUTC - date.getTime()) / 60000);
}

/**
 * Next instant at or after `from` that falls inside the recipient's local
 * send window. This is how every sequence step is made time-zone aware.
 */
export function nextSendTime(from: Date, tz: string, window: [number, number]): Date {
  const d = new Date(from);
  for (let i = 0; i < 48; i++) {
    const h = localHour(d, tz);
    if (h >= window[0] && h < window[1]) return d;
    d.setUTCMinutes(0, 0, 0);
    d.setUTCHours(d.getUTCHours() + 1);
  }
  return d;
}

export function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}
