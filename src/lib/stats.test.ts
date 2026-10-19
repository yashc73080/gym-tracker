import { describe, expect, it } from "vitest";
import { agoLabel, bestByReps, dailyPoints, dayLabel, epley, findPrs, groupByDay, timeLabel, type SetRow } from "./stats";

const s = (id: string, at: string, reps: number | null, weight: number | null, durationS: number | null = null): SetRow => ({
  id, performedAt: at, reps, weight, durationS, note: null,
});

describe("stats", () => {
  it("epley", () => {
    expect(epley(100, 1)).toBe(100);
    expect(epley(100, 10)).toBeCloseTo(133.33, 1);
    expect(epley(0, 10)).toBeNull();
  });

  it("flags a set as PR only when nothing earlier matched or beat it", () => {
    const sets = [
      s("a", "2026-09-26 11:15:00", 10, 35),
      s("b", "2026-09-26 11:20:00", 10, 40), // beats a
      s("c", "2026-10-10 18:45:00", 12, 40), // more reps
      s("d", "2026-10-10 18:49:00", 12, 45), // heavier
      s("e", "2026-10-17 11:14:00", 10, 45), // dominated by d
      s("f", "2026-10-17 11:18:00", 12, 45), // equal to d: not a PR
    ];
    expect([...findPrs(sets)].sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("handles bodyweight and timed sets", () => {
    const prs = findPrs([
      s("a", "2026-01-01 10:00:00", 10, 0),
      s("b", "2026-01-02 10:00:00", 12, 0),
      s("c", "2026-01-03 10:00:00", null, null, 30),
      s("d", "2026-01-04 10:00:00", null, null, 60),
      s("e", "2026-01-05 10:00:00", null, null, 60),
    ]);
    expect([...prs].sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("groups newest day first, numbering sets oldest first", () => {
    const sets = [s("a", "2026-10-10 18:49:00", 12, 45), s("b", "2026-10-10 18:45:00", 12, 40), s("c", "2026-10-17 11:14:00", 10, 45)];
    const g = groupByDay(sets, new Set(["a"]));
    expect(g.map((d) => d.day)).toEqual(["2026-10-17", "2026-10-10"]);
    expect(g[1].sets.map((x) => [x.id, x.n, x.pr])).toEqual([["b", 1, false], ["a", 2, true]]);
  });

  it("daily points and best by reps", () => {
    const sets = [s("a", "2026-10-10 18:45:00", 10, 40), s("b", "2026-10-10 18:49:00", 8, 50), s("c", "2026-10-17 11:14:00", 10, 45)];
    const p = dailyPoints(sets);
    expect(p[0]).toMatchObject({ day: "2026-10-10", maxWeight: 50, totalReps: 18, volume: 800, sets: 2 });
    expect(bestByReps(sets)).toEqual([
      { reps: 8, weight: 50, at: "2026-10-10 18:49:00" },
      { reps: 10, weight: 45, at: "2026-10-17 11:14:00" },
    ]);
  });

  it("labels", () => {
    expect(dayLabel("2026-10-17", "2026-10-18")).toBe("Yesterday");
    expect(dayLabel("2026-10-18", "2026-10-18")).toBe("Today");
    expect(dayLabel("2026-10-10", "2026-10-18")).toBe("Sat, 10 Oct 2026");
    expect(agoLabel("2026-10-18", "2026-10-18")).toBe("Today");
    expect(agoLabel("2026-10-16", "2026-10-18")).toBe("2d ago");
    expect(agoLabel("2026-09-18", "2026-10-18")).toBe("4w ago");
    expect(agoLabel("2026-04-18", "2026-10-18")).toBe("6mo ago");
    expect(timeLabel("2026-10-10 18:45:00")).toBe("6:45 PM");
    expect(timeLabel("2026-10-10 00:05:00")).toBe("12:05 AM");
  });
});
