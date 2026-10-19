import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSetCsv } from "./import/setgraph";
import { musclesFor } from "./muscles";

const file = join(process.cwd(), "samples", "Setgraph_Set_Export_2026-10-18.csv");

describe("musclesFor", () => {
  const cases: [string, string][] = [
    ["Bench Press", "Chest"],
    ["Dumbbell Fly", "Chest"],
    ["Incline Dumbbell Press", "Chest"],
    ["Pull-Up", "Back"],
    ["Lat Pulldown", "Back"],
    ["Seated Cable Row", "Back"],
    ["Dumbbell Shoulder Press", "Shoulders"],
    ["Lateral Shoulder Raise", "Shoulders"],
    ["Cable Overhead Triceps Extension", "Triceps"],
    ["Dips", "Triceps"],
    ["Dumbbell Preacher Curls", "Biceps"],
    ["Hammer Curl", "Biceps"],
    ["Dumbbell Wrist Curl", "Forearms"],
    ["Reverse Barbell Curl", "Forearms"],
    ["Leg Extension", "Quads"],
    ["Leg Curl", "Hamstrings"],
    ["Dumbbell Calf Raises", "Calves"],
    ["Dumbbell Shrug", "Traps"],
    ["Captain�s Chair Knee Raise", "Abs"],
    ["Captain�s Chair Side Raise", "Obliques"],
    ["Plank", "Abs"],
    ["Push-Up", "Chest"],
    ["Face Pull", "Shoulders"],
  ];
  it.each(cases)("%s -> %s", (name, primary) => {
    expect(musclesFor(name)[0]).toBe(primary);
  });

  it.skipIf(!existsSync(file))("covers every exercise in the sample export", () => {
    const names = [...new Set(parseSetCsv(readFileSync(file, "utf8")).map((s) => s.exercise))];
    expect(names.filter((n) => musclesFor(n).length === 0)).toEqual([]);
  });
});
