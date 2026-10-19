import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  diffRows,
  findSession,
  inferExerciseProps,
  parseSessionCsv,
  parseSetCsv,
} from "./setgraph";

const dir = join(process.cwd(), "samples");
const setFile = join(dir, "Setgraph_Set_Export_2026-10-18.csv");
const sessFile = join(dir, "Setgraph_Sessions_Export_2026-10-18.csv");
const haveSamples = existsSync(setFile) && existsSync(sessFile);

const toMap = (rows: { sourceKey: string; sourceHash: string }[]) =>
  new Map(rows.map((r) => [r.sourceKey, r.sourceHash]));

describe.skipIf(!haveSamples)("sample exports", () => {
  const sets = haveSamples ? parseSetCsv(readFileSync(setFile, "utf8")) : [];
  const sessions = haveSamples ? parseSessionCsv(readFileSync(sessFile, "utf8")) : [];

  it("parses every row", () => {
    expect(sets).toHaveLength(1794);
    expect(new Set(sets.map((s) => s.exercise)).size).toBe(115);
    expect(sessions).toHaveLength(189);
  });

  it("source keys are unique for sets", () => {
    expect(new Set(sets.map((s) => s.sourceKey)).size).toBe(sets.length);
  });

  it("first import adds all; identical re-import changes nothing", () => {
    const first = diffRows(sets, new Map());
    expect(first.added).toHaveLength(sets.length);
    const again = diffRows(sets, toMap(sets));
    expect(again.added).toHaveLength(0);
    expect(again.updated).toHaveLength(0);
    expect(again.unchanged).toBe(sets.length);
  });

  it("an edited set updates, a new set adds, a missing set is untouched", () => {
    const stored = toMap(sets.slice(1)); // pretend row 0 is new
    const edited = sets.map((s, i) => (i === 5 ? parseSetCsv(
      `Exercise,Date,Repetitions,Weight (lb)\n${s.exercise},${s.performedAt},${(s.reps ?? 0) + 1},${s.weightLb}\n`,
    )[0] : s));
    const d = diffRows(edited.slice(0, -1), stored); // last row absent from file
    expect(d.added).toHaveLength(1);
    expect(d.updated).toHaveLength(1);
  });

  it("links ~all sets to a Setgraph session by time", () => {
    const sg = sessions.filter((s) => s.source === "Setgraph");
    const linked = sets.filter((s) => findSession(s.performedAt, sg) !== -1).length;
    expect(linked / sets.length).toBeGreaterThan(0.95);
  });

  it("infers duration-only exercises", () => {
    const plank = inferExerciseProps(sets.filter((s) => s.exercise === "Plank"));
    expect(plank.usesDuration).toBe(true);
    expect(plank.usesWeight).toBe(false);
  });

  it("parses HealthKit metadata", () => {
    const walk = sessions.find((s) => s.activityType === "Walking")!;
    expect(walk.metadata.HKTimeZone).toBe("America/New_York");
  });
});

describe("parsers", () => {
  it("rejects a CSV with the wrong columns", () => {
    expect(() => parseSetCsv("a,b\n1,2\n")).toThrow(/missing column/);
  });
});
