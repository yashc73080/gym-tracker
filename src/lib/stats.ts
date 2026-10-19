export type SetRow = {
  id: string;
  performedAt: string; // "YYYY-MM-DD HH:MM:SS"
  reps: number | null;
  weight: number | null; // lb
  durationS: number | null;
  note: string | null;
};

export type DayGroup = { day: string; sets: (SetRow & { n: number; pr: boolean })[] };

/** Epley estimated one-rep max; null unless both weight and reps are present. */
export function epley(weight: number | null, reps: number | null): number | null {
  if (!weight || !reps || weight <= 0 || reps <= 0) return null;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

/**
 * Ids of sets that were a personal record when performed: no earlier set matched or beat them
 * on weight, reps and duration at once. Bodyweight sets (no weight) compete on reps/duration.
 */
export function findPrs(sets: SetRow[]): Set<string> {
  const ordered = [...sets].sort((a, b) => a.performedAt.localeCompare(b.performedAt));
  const frontier: { w: number; r: number; d: number }[] = [];
  const prs = new Set<string>();
  for (const s of ordered) {
    const p = { w: s.weight ?? 0, r: s.reps ?? 0, d: s.durationS ?? 0 };
    if (p.w === 0 && p.r === 0 && p.d === 0) continue;
    const dominated = frontier.some((f) => f.w >= p.w && f.r >= p.r && f.d >= p.d);
    if (dominated) continue;
    prs.add(s.id);
    // Keep the frontier small: drop points this one dominates.
    for (let i = frontier.length - 1; i >= 0; i--) {
      const f = frontier[i];
      if (p.w >= f.w && p.r >= f.r && p.d >= f.d) frontier.splice(i, 1);
    }
    frontier.push(p);
  }
  return prs;
}

/** Newest day first; sets within a day oldest first and numbered. */
export function groupByDay(sets: SetRow[], prs: Set<string>): DayGroup[] {
  const byDay = new Map<string, SetRow[]>();
  for (const s of sets) {
    const day = s.performedAt.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), s]);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, rows]) => ({
      day,
      sets: rows
        .sort((a, b) => a.performedAt.localeCompare(b.performedAt))
        .map((s, i) => ({ ...s, n: i + 1, pr: prs.has(s.id) })),
    }));
}

export type DayPoint = {
  day: string;
  maxWeight: number;
  totalReps: number;
  volume: number;
  sets: number;
  e1rm: number | null;
  durationS: number;
};

/** One point per day, oldest first, for charts. */
export function dailyPoints(sets: SetRow[]): DayPoint[] {
  const days = new Map<string, DayPoint>();
  for (const s of sets) {
    const day = s.performedAt.slice(0, 10);
    const p = days.get(day) ?? { day, maxWeight: 0, totalReps: 0, volume: 0, sets: 0, e1rm: null, durationS: 0 };
    p.maxWeight = Math.max(p.maxWeight, s.weight ?? 0);
    p.totalReps += s.reps ?? 0;
    p.volume += (s.weight ?? 0) * (s.reps ?? 0);
    p.sets += 1;
    p.durationS += s.durationS ?? 0;
    const e = epley(s.weight, s.reps);
    if (e != null) p.e1rm = Math.max(p.e1rm ?? 0, e);
    days.set(day, p);
  }
  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** Best weight lifted for each rep count. */
export function bestByReps(sets: SetRow[]) {
  const best = new Map<number, { weight: number; at: string }>();
  for (const s of sets) {
    if (!s.reps || !s.weight) continue;
    const cur = best.get(s.reps);
    if (!cur || s.weight > cur.weight) best.set(s.reps, { weight: s.weight, at: s.performedAt });
  }
  return [...best.entries()].sort(([a], [b]) => a - b).map(([reps, v]) => ({ reps, ...v }));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Today", "Yesterday" or "Sat, 10 Oct 2026". `today` is a YYYY-MM-DD string. */
export function dayLabel(day: string, today: string) {
  const d = new Date(`${day}T00:00:00Z`);
  const diff = Math.round((new Date(`${today}T00:00:00Z`).getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "Today", "Yesterday", "3d ago", "5w ago", "4mo ago". Both arguments are YYYY-MM-DD. */
export function agoLabel(day: string, today: string) {
  const diff = Math.round((new Date(`${today}T00:00:00Z`).getTime() - new Date(`${day}T00:00:00Z`).getTime()) / 86_400_000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 14) return `${diff}d ago`;
  if (diff < 60) return `${Math.round(diff / 7)}w ago`;
  return `${Math.round(diff / 30)}mo ago`;
}

/** "6:45 PM" from "YYYY-MM-DD HH:MM:SS". */
export function timeLabel(ts: string) {
  const h = Number(ts.slice(11, 13));
  const m = ts.slice(14, 16);
  return `${h % 12 || 12}:${m} ${h < 12 ? "AM" : "PM"}`;
}

export const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));
