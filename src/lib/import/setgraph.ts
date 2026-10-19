import Papa from "papaparse";
import { createHash } from "node:crypto";

export type ParsedSet = {
  exercise: string;
  performedAt: string; // "YYYY-MM-DD HH:MM:SS", naive local time
  reps: number | null;
  weightLb: number | null;
  durationS: number | null;
  note: string | null;
  label: string | null;
  sourceKey: string;
  sourceHash: string;
};

export type ParsedSession = {
  activityType: string;
  startedAt: string;
  endedAt: string | null;
  durationS: number | null;
  calories: number | null;
  distanceM: number | null;
  source: string | null;
  location: string | null;
  notes: string | null;
  metadata: Record<string, string>;
  sourceKey: string;
  sourceHash: string;
};

const hash = (...parts: (string | number | null)[]) =>
  createHash("sha1").update(parts.map((p) => p ?? "").join("\u0001")).digest("hex");

const num = (v: string | undefined) => {
  if (v == null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: string | undefined) => (v && v.trim() !== "" ? v.trim() : null);

function readCsv(text: string, required: string[]): Record<string, string>[] {
  const res = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: true,
  });
  const missing = required.filter((c) => !res.meta.fields?.includes(c));
  if (missing.length) throw new Error(`Unrecognised CSV: missing column(s) ${missing.join(", ")}`);
  return res.data;
}

/** Setgraph "Set Export": Exercise,Date,Repetitions,Weight (lb),Weight (kg),Duration (seconds),... */
export function parseSetCsv(text: string): ParsedSet[] {
  const rows = readCsv(text, ["Exercise", "Date", "Repetitions", "Weight (lb)"]);
  return rows.map((r) => {
    const exercise = r["Exercise"].trim();
    const performedAt = r["Date"].trim();
    const reps = num(r["Repetitions"]);
    const weightLb = num(r["Weight (lb)"]);
    const durationS = num(r["Duration (seconds)"]);
    const note = str(r["Note"]);
    const label = str(r["Label"]);
    return {
      exercise,
      performedAt,
      reps,
      weightLb,
      durationS,
      note,
      label,
      sourceKey: `${exercise}|${performedAt}`,
      sourceHash: hash(reps, weightLb, durationS, note, label),
    };
  });
}

/** Setgraph "Sessions Export" (Apple Health workouts): Activity Type,Start Date,End Date,... */
export function parseSessionCsv(text: string): ParsedSession[] {
  const rows = readCsv(text, ["Activity Type", "Start Date", "End Date", "Duration (seconds)"]);
  return rows.map((r) => {
    const metadata: Record<string, string> = {};
    for (const part of (r["Custom Metadata"] ?? "").split(";")) {
      const i = part.indexOf("=");
      if (i > 0) metadata[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    }
    const s: Omit<ParsedSession, "sourceKey" | "sourceHash"> = {
      activityType: r["Activity Type"].trim(),
      startedAt: r["Start Date"].trim(),
      endedAt: str(r["End Date"]),
      durationS: num(r["Duration (seconds)"]),
      calories: num(r["Calories (kcal)"]),
      distanceM: num(r["Distance (meters)"]),
      source: str(r["Source"]),
      location: str(r["Location"]),
      notes: str(r["Notes"]),
      metadata,
    };
    return {
      ...s,
      sourceKey: `${s.activityType}|${s.startedAt}`,
      sourceHash: hash(s.endedAt, s.durationS, s.calories, s.distanceM, s.source, s.location, s.notes, JSON.stringify(metadata)),
    };
  });
}

export type Diff<T> = { added: T[]; updated: T[]; unchanged: number };

/**
 * Compare incoming rows with what is stored (sourceKey -> sourceHash).
 * Unchanged rows are left alone; rows missing from the file are never deleted.
 */
export function diffRows<T extends { sourceKey: string; sourceHash: string }>(
  incoming: T[],
  existing: Map<string, string>,
): Diff<T> {
  const out: Diff<T> = { added: [], updated: [], unchanged: 0 };
  const seen = new Set<string>();
  for (const row of incoming) {
    if (seen.has(row.sourceKey)) continue; // duplicate key inside the file: first wins
    seen.add(row.sourceKey);
    const prev = existing.get(row.sourceKey);
    if (prev === undefined) out.added.push(row);
    else if (prev !== row.sourceHash) out.updated.push(row);
    else out.unchanged++;
  }
  return out;
}

/** Index of the session whose [start, end] window contains the set time, or -1. Ties: latest start. */
export function findSession(
  performedAt: string,
  sessions: { startedAt: string; endedAt: string | null }[],
): number {
  let best = -1;
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    if (!s.endedAt) continue;
    // "YYYY-MM-DD HH:MM:SS" compares correctly as a string
    if (s.startedAt <= performedAt && performedAt <= s.endedAt) {
      if (best === -1 || s.startedAt > sessions[best].startedAt) best = i;
    }
  }
  return best;
}

/** Exercise tracking properties inferred from the data seen for it. */
export function inferExerciseProps(sets: ParsedSet[]) {
  const usesDuration = sets.some((s) => s.durationS != null);
  const usesReps = sets.some((s) => s.reps != null);
  const usesWeight = sets.some((s) => (s.weightLb ?? 0) > 0);
  return { usesReps, usesWeight, usesDuration };
}
