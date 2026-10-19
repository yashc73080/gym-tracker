"use server";

import { and, asc, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/auth";
import { COLORS } from "@/lib/colors";
import { syncMuscleLists } from "@/lib/library";

const { folders, lists, listExercises, exercises } = schema;

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optId = (f: FormData, k: string) => text(f, k) || null;
const color = (f: FormData) => {
  const c = text(f, "color");
  return (COLORS as readonly string[]).includes(c) ? c : null;
};
const refresh = () => revalidatePath("/library", "layout");

async function ownList(userId: string, listId: string) {
  const [l] = await db
    .select({ id: lists.id })
    .from(lists)
    .where(and(eq(lists.id, listId), eq(lists.userId, userId)));
  if (!l) throw new Error("List not found");
}

async function ownFolderOrNull(userId: string, folderId: string | null) {
  if (!folderId) return null;
  const [f] = await db
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId)));
  if (!f) throw new Error("Folder not found");
  return f.id;
}

export async function createFolder(formData: FormData) {
  const userId = await requireUserId();
  const name = text(formData, "name");
  if (!name) return;
  const parentId = await ownFolderOrNull(userId, optId(formData, "parentId"));
  const [m] = await db.select({ n: max(folders.sort) }).from(folders).where(eq(folders.userId, userId));
  await db.insert(folders).values({ userId, name, parentId, color: color(formData), sort: (m?.n ?? 0) + 1 });
  refresh();
}

export async function createList(formData: FormData) {
  const userId = await requireUserId();
  const name = text(formData, "name");
  if (!name) return;
  const folderId = await ownFolderOrNull(userId, optId(formData, "folderId"));
  const [m] = await db.select({ n: max(lists.sort) }).from(lists).where(eq(lists.userId, userId));
  await db.insert(lists).values({ userId, name, folderId, color: color(formData), sort: (m?.n ?? 0) + 1 });
  refresh();
}

export async function updateFolder(formData: FormData) {
  const userId = await requireUserId();
  const id = text(formData, "id");
  const name = text(formData, "name");
  if (!name) return;
  await db
    .update(folders)
    .set({ name, color: color(formData) })
    .where(and(eq(folders.id, id), eq(folders.userId, userId)));
  refresh();
}

export async function updateList(formData: FormData) {
  const userId = await requireUserId();
  const id = text(formData, "id");
  const name = text(formData, "name");
  if (!name) return;
  await db
    .update(lists)
    .set({ name, color: color(formData), notes: text(formData, "notes") || null })
    .where(and(eq(lists.id, id), eq(lists.userId, userId)));
  refresh();
}

export async function moveList(formData: FormData) {
  const userId = await requireUserId();
  const folderId = await ownFolderOrNull(userId, optId(formData, "folderId"));
  await db
    .update(lists)
    .set({ folderId })
    .where(and(eq(lists.id, text(formData, "id")), eq(lists.userId, userId)));
  refresh();
}

export async function deleteFolder(formData: FormData) {
  const userId = await requireUserId();
  // Lists inside become top-level (FK on delete set null); sub-folders are removed with it.
  await db.delete(folders).where(and(eq(folders.id, text(formData, "id")), eq(folders.userId, userId)));
  refresh();
}

export async function deleteList(formData: FormData) {
  const userId = await requireUserId();
  await db.delete(lists).where(and(eq(lists.id, text(formData, "id")), eq(lists.userId, userId)));
  refresh();
}

export async function addExerciseToList(formData: FormData) {
  const userId = await requireUserId();
  const listId = text(formData, "listId");
  const exerciseId = text(formData, "exerciseId");
  await ownList(userId, listId);
  const [ex] = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(and(eq(exercises.id, exerciseId), eq(exercises.userId, userId)));
  if (!ex) throw new Error("Exercise not found");
  const [m] = await db
    .select({ n: max(listExercises.position) })
    .from(listExercises)
    .where(eq(listExercises.listId, listId));
  await db
    .insert(listExercises)
    .values({ listId, exerciseId, position: (m?.n ?? -1) + 1 })
    .onConflictDoNothing();
  refresh();
}

export async function removeExerciseFromList(formData: FormData) {
  const userId = await requireUserId();
  const listId = text(formData, "listId");
  await ownList(userId, listId);
  await db
    .delete(listExercises)
    .where(and(eq(listExercises.listId, listId), eq(listExercises.exerciseId, text(formData, "exerciseId"))));
  refresh();
}

export async function moveExerciseInList(formData: FormData) {
  const userId = await requireUserId();
  const listId = text(formData, "listId");
  const exerciseId = text(formData, "exerciseId");
  const dir = text(formData, "dir") === "up" ? -1 : 1;
  await ownList(userId, listId);
  const rows = await db
    .select({ id: listExercises.id, exerciseId: listExercises.exerciseId })
    .from(listExercises)
    .where(eq(listExercises.listId, listId))
    .orderBy(asc(listExercises.position), asc(listExercises.id));
  const i = rows.findIndex((r) => r.exerciseId === exerciseId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await db.transaction(async (tx) => {
    for (let p = 0; p < rows.length; p++) {
      await tx.update(listExercises).set({ position: p }).where(eq(listExercises.id, rows[p].id));
    }
  });
  refresh();
}

/** One click: a "Muscle Groups" folder with a list per muscle, filled from the exercises' primary muscle. */
export async function buildMuscleLists() {
  const userId = await requireUserId();
  await syncMuscleLists(db, userId, { create: true });
  refresh();
}
