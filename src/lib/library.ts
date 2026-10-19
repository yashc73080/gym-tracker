import { and, eq, inArray, isNull, max } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Muscle } from "./muscles";
import { MUSCLES } from "./muscles";

const { folders, lists, listExercises, exercises } = schema;
type Executor = Pick<typeof db, "select" | "insert">;

export const MUSCLE_FOLDER = "Muscle Groups";

const GROUP_COLOR: Record<Muscle, string> = {
  Chest: "red", Shoulders: "red", Triceps: "red",
  Back: "blue", Biceps: "blue", Forearms: "blue", Traps: "blue", "Lower Back": "blue", Neck: "blue",
  Quads: "green", Hamstrings: "green", Glutes: "green", Calves: "green", Hips: "green",
  Abs: "yellow", Obliques: "yellow",
};

/**
 * Put exercises into a list per primary muscle, inside a "Muscle Groups" folder.
 * Creates the folder and lists on demand (`create: true`); otherwise only fills lists that already exist.
 * Safe to run repeatedly: it never removes or duplicates anything.
 */
export async function syncMuscleLists(
  tx: Executor,
  userId: string,
  opts: { create: boolean; exerciseIds?: string[] },
) {
  let [folder] = await tx
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.userId, userId), eq(folders.name, MUSCLE_FOLDER), isNull(folders.parentId)));
  if (!folder) {
    if (!opts.create) return { listsCreated: 0, added: 0 };
    const [m] = await tx.select({ n: max(folders.sort) }).from(folders).where(eq(folders.userId, userId));
    [folder] = await tx
      .insert(folders)
      .values({ userId, name: MUSCLE_FOLDER, color: "gray", sort: (m?.n ?? 0) + 1 })
      .returning({ id: folders.id });
  }

  const exRows = await tx
    .select({ id: exercises.id, name: exercises.name, muscles: exercises.muscleGroups })
    .from(exercises)
    .where(opts.exerciseIds ? and(eq(exercises.userId, userId), inArray(exercises.id, opts.exerciseIds)) : eq(exercises.userId, userId));

  const byPrimary = new Map<string, typeof exRows>();
  for (const e of exRows) {
    const p = e.muscles[0];
    if (p) byPrimary.set(p, [...(byPrimary.get(p) ?? []), e]);
  }

  const existingLists = await tx
    .select({ id: lists.id, name: lists.name })
    .from(lists)
    .where(and(eq(lists.userId, userId), eq(lists.folderId, folder.id)));
  const listIds = new Map(existingLists.map((l) => [l.name, l.id]));

  let listsCreated = 0;
  let added = 0;
  for (const muscle of MUSCLES) {
    const exs = (byPrimary.get(muscle) ?? []).sort((a, b) => a.name.localeCompare(b.name));
    if (exs.length === 0) continue;
    let listId = listIds.get(muscle);
    if (!listId) {
      if (!opts.create) continue;
      const [m] = await tx.select({ n: max(lists.sort) }).from(lists).where(eq(lists.userId, userId));
      [{ id: listId }] = await tx
        .insert(lists)
        .values({ userId, name: muscle, folderId: folder.id, color: GROUP_COLOR[muscle], sort: (m?.n ?? 0) + 1 })
        .returning({ id: lists.id });
      listIds.set(muscle, listId);
      listsCreated++;
    }
    const [pos] = await tx.select({ n: max(listExercises.position) }).from(listExercises).where(eq(listExercises.listId, listId));
    let position = (pos?.n ?? -1) + 1;
    const inserted = await tx
      .insert(listExercises)
      .values(exs.map((e) => ({ listId: listId!, exerciseId: e.id, position: position++ })))
      .onConflictDoNothing()
      .returning({ id: listExercises.id });
    added += inserted.length;
  }
  return { listsCreated, added };
}
