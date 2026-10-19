import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { syncMuscleLists } from "@/lib/library";
import { musclesFor } from "@/lib/muscles";
import {
  diffRows,
  inferExerciseProps,
  parseSessionCsv,
  parseSetCsv,
  type Diff,
  type ParsedSession,
  type ParsedSet,
} from "./setgraph";

const { exercises, sessions, sets, imports } = schema;
const CHUNK = 500;

export type ImportSummary = {
  committed: boolean;
  sets?: { total: number; added: number; updated: number; unchanged: number };
  sessions?: { total: number; added: number; updated: number; unchanged: number };
  newExercises: string[];
  updatedSets: { exercise: string; at: string }[]; // first few, for the preview
  warnings: string[];
};

export type ImportFile = { name: string; text: string };

const counts = <T,>(total: number, d: Diff<T>) => ({
  total,
  added: d.added.length,
  updated: d.updated.length,
  unchanged: d.unchanged,
});

function chunks<T>(rows: T[], n = CHUNK) {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += n) out.push(rows.slice(i, i + n));
  return out;
}

/** Decide what a CSV is from its header row (file names can be changed). */
export function classifyCsv(text: string): "sets" | "sessions" | "unknown" {
  const header = text.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "";
  if (header.includes("Activity Type") && header.includes("Start Date")) return "sessions";
  if (header.startsWith("Exercise,") && header.includes("Repetitions")) return "sets";
  return "unknown";
}

const asMap = (rows: { sourceKey: string; sourceHash: string | null }[]) =>
  new Map(rows.map((r) => [r.sourceKey, r.sourceHash ?? ""]));

/** Preview (commit=false) or apply (commit=true) an import. Unchanged rows are never touched; nothing is deleted. */
export async function runImport(userId: string, files: ImportFile[], commit: boolean): Promise<ImportSummary> {
  const summary: ImportSummary = { committed: commit, newExercises: [], updatedSets: [], warnings: [] };
  let parsedSets: ParsedSet[] = [];
  let parsedSessions: ParsedSession[] = [];
  let sawSets = false;
  let sawSessions = false;

  for (const f of files) {
    const kind = classifyCsv(f.text);
    try {
      if (kind === "sets") {
        sawSets = true;
        parsedSets = parsedSets.concat(parseSetCsv(f.text));
      } else if (kind === "sessions") {
        sawSessions = true;
        parsedSessions = parsedSessions.concat(parseSessionCsv(f.text));
      } else summary.warnings.push(`${f.name}: not a Setgraph set or session export, skipped.`);
    } catch (e) {
      summary.warnings.push(`${f.name}: ${(e as Error).message}`);
    }
  }

  // ---- diff against what is stored
  const existingExercises = await db
    .select({ id: exercises.id, name: exercises.name })
    .from(exercises)
    .where(eq(exercises.userId, userId));
  const exerciseIds = new Map(existingExercises.map((e) => [e.name, e.id]));

  const setDiff = sawSets
    ? diffRows(
        parsedSets,
        asMap(
          await db
            .select({ sourceKey: sets.sourceKey, sourceHash: sets.sourceHash })
            .from(sets)
            .where(eq(sets.userId, userId)),
        ),
      )
    : null;
  const sessionDiff = sawSessions
    ? diffRows(
        parsedSessions,
        asMap(
          await db
            .select({ sourceKey: sessions.sourceKey, sourceHash: sessions.sourceHash })
            .from(sessions)
            .where(eq(sessions.userId, userId)),
        ),
      )
    : null;

  if (setDiff) summary.sets = counts(parsedSets.length, setDiff);
  if (sessionDiff) summary.sessions = counts(parsedSessions.length, sessionDiff);
  summary.updatedSets = (setDiff?.updated ?? []).slice(0, 10).map((s) => ({ exercise: s.exercise, at: s.performedAt }));
  summary.newExercises = [...new Set(parsedSets.map((s) => s.exercise))].filter((n) => !exerciseIds.has(n)).sort();

  if (!commit) return summary;

  // ---- apply
  await db.transaction(async (tx) => {
    // New exercises, with the muscle mapping seeded and tracking properties inferred from the data.
    const byName = new Map<string, ParsedSet[]>();
    for (const s of parsedSets) byName.set(s.exercise, [...(byName.get(s.exercise) ?? []), s]);
    for (const name of summary.newExercises) {
      const props = inferExerciseProps(byName.get(name) ?? []);
      const [row] = await tx
        .insert(exercises)
        .values({ userId, name, ...props, muscleGroups: musclesFor(name) })
        .onConflictDoNothing()
        .returning({ id: exercises.id });
      if (row) exerciseIds.set(name, row.id);
    }
    // onConflictDoNothing returns nothing when it lost a race: look those up.
    const missing = summary.newExercises.filter((n) => !exerciseIds.has(n));
    if (missing.length) {
      const rows = await tx.select({ id: exercises.id, name: exercises.name }).from(exercises).where(eq(exercises.userId, userId));
      rows.forEach((r) => exerciseIds.set(r.name, r.id));
    }

    if (sessionDiff) {
      const toRow = (s: ParsedSession) => ({
        userId,
        activityType: s.activityType,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        durationS: s.durationS,
        calories: s.calories == null ? null : String(s.calories),
        distanceM: s.distanceM == null ? null : String(s.distanceM),
        source: s.source,
        location: s.location,
        notes: s.notes,
        metadata: s.metadata,
        sourceKey: s.sourceKey,
        sourceHash: s.sourceHash,
      });
      for (const c of chunks(sessionDiff.added)) await tx.insert(sessions).values(c.map(toRow));
      for (const s of sessionDiff.updated) {
        const { userId: _u, sourceKey: _k, ...rest } = toRow(s);
        await tx.update(sessions).set(rest).where(and(eq(sessions.userId, userId), eq(sessions.sourceKey, s.sourceKey)));
      }
    }

    if (setDiff) {
      const toRow = (s: ParsedSet) => ({
        userId,
        exerciseId: exerciseIds.get(s.exercise)!,
        performedAt: s.performedAt,
        reps: s.reps == null ? null : String(s.reps),
        weightLb: s.weightLb == null ? null : String(s.weightLb),
        durationS: s.durationS,
        note: s.note,
        label: s.label,
        sourceKey: s.sourceKey,
        sourceHash: s.sourceHash,
      });
      for (const c of chunks(setDiff.added)) await tx.insert(sets).values(c.map(toRow));
      for (const s of setDiff.updated) {
        const { userId: _u, exerciseId: _e, performedAt: _p, sourceKey: _k, ...rest } = toRow(s);
        await tx.update(sets).set(rest).where(and(eq(sets.userId, userId), eq(sets.sourceKey, s.sourceKey)));
      }
    }

    // Attach sets to the Setgraph session whose time window contains them (latest start wins).
    await tx.execute(sql`
      update sets s set session_id = (
        select x.id from sessions x
        where x.user_id = s.user_id and x.source = 'Setgraph'
          and x.started_at <= s.performed_at and s.performed_at <= x.ended_at
        order by x.started_at desc limit 1)
      where s.user_id = ${userId} and s.session_id is null`);

    // New exercises join their muscle-group list, if the user has built those lists.
    if (summary.newExercises.length) {
      const ids = summary.newExercises.map((n) => exerciseIds.get(n)).filter((i): i is string => !!i);
      await syncMuscleLists(tx, userId, { create: false, exerciseIds: ids });
    }

    const fileHash = createHash("sha1").update(files.map((f) => f.text).join("\u0000")).digest("hex");
    await tx.insert(imports).values({ userId, fileHash, stats: summary });
  });

  return summary;
}
