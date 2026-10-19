"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/auth";
import { MUSCLES } from "@/lib/muscles";

export async function updateExerciseMuscles(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  const checked = formData.getAll("muscle").map(String).filter((m) => (MUSCLES as readonly string[]).includes(m));

  const [ex] = await db
    .select({ muscleGroups: schema.exercises.muscleGroups })
    .from(schema.exercises)
    .where(and(eq(schema.exercises.id, id), eq(schema.exercises.userId, userId)));
  if (!ex) throw new Error("Exercise not found");

  // Keep the existing order (first = primary); append newly ticked muscles.
  const kept = ex.muscleGroups.filter((m) => checked.includes(m));
  const muscleGroups = [...kept, ...checked.filter((m) => !kept.includes(m))];
  await db
    .update(schema.exercises)
    .set({ muscleGroups })
    .where(and(eq(schema.exercises.id, id), eq(schema.exercises.userId, userId)));
  revalidatePath("/exercises", "layout");
}
