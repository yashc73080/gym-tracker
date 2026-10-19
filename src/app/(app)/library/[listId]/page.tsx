import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, notInArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/auth";
import { hexFor } from "@/lib/colors";
import { agoLabel } from "@/lib/stats";
import { ColorPicker } from "@/components/ColorPicker";
import { ExercisePicker } from "@/components/ExercisePicker";
import { addExerciseToList, moveExerciseInList, removeExerciseFromList, updateList } from "../actions";

export default async function ListPage({ params }: PageProps<"/library/[listId]">) {
  const { listId } = await params;
  const userId = await requireUserId();
  if (!/^[0-9a-f-]{36}$/i.test(listId)) notFound();

  const [list] = await db
    .select()
    .from(schema.lists)
    .where(and(eq(schema.lists.id, listId), eq(schema.lists.userId, userId)));
  if (!list) notFound();

  const items = await db
    .select({
      exerciseId: schema.exercises.id,
      name: schema.exercises.name,
      muscles: schema.exercises.muscleGroups,
      last: sql<string | null>`(select max(performed_at)::text from sets s where s.exercise_id = "exercises"."id")`,
    })
    .from(schema.listExercises)
    .innerJoin(schema.exercises, eq(schema.exercises.id, schema.listExercises.exerciseId))
    .where(eq(schema.listExercises.listId, listId))
    .orderBy(asc(schema.listExercises.position), asc(schema.listExercises.id));

  const today = new Date().toISOString().slice(0, 10);
  const inList = items.map((i) => i.exerciseId);
  const available = await db
    .select({ id: schema.exercises.id, name: schema.exercises.name, muscles: schema.exercises.muscleGroups })
    .from(schema.exercises)
    .where(
      inList.length
        ? and(eq(schema.exercises.userId, userId), notInArray(schema.exercises.id, inList))
        : eq(schema.exercises.userId, userId),
    )
    .orderBy(asc(schema.exercises.name));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <Link href="/library" className="rounded-full bg-card px-3 py-2" aria-label="Back to library">
          ‹
        </Link>
        <span className="h-4 w-4 rounded-sm" style={{ background: hexFor(list.color) }} />
        <h1 className="flex-1 truncate text-2xl font-bold">{list.name}</h1>
        <span className="text-sm text-muted">{items.length} exercises</span>
      </header>

      <ul className="divide-y divide-line rounded-2xl bg-card">
        {items.map((it, idx) => (
          <li key={it.exerciseId} className="flex items-center gap-2 px-3 py-3">
            <Link href={`/exercises/${it.exerciseId}`} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 hover:bg-card2">
              <div className="min-w-0 flex-1">
                <p className="truncate">{it.name}</p>
                <p className="truncate text-sm text-muted">
                  {it.muscles.join(", ") || "No muscle set"}
                  {it.last && <> · {agoLabel(it.last.slice(0, 10), today)}</>}
                </p>
              </div>
              <span className="text-muted">›</span>
            </Link>
            {(["up", "down"] as const).map((dir) => (
              <form key={dir} action={moveExerciseInList}>
                <input type="hidden" name="listId" value={listId} />
                <input type="hidden" name="exerciseId" value={it.exerciseId} />
                <input type="hidden" name="dir" value={dir} />
                <button
                  disabled={(dir === "up" && idx === 0) || (dir === "down" && idx === items.length - 1)}
                  className="rounded-lg px-2 py-1 text-muted hover:bg-card2 disabled:opacity-30"
                  aria-label={`Move ${dir}`}
                >
                  {dir === "up" ? "↑" : "↓"}
                </button>
              </form>
            ))}
            <form action={removeExerciseFromList}>
              <input type="hidden" name="listId" value={listId} />
              <input type="hidden" name="exerciseId" value={it.exerciseId} />
              <button className="rounded-lg px-2 py-1 text-red-400 hover:bg-card2" aria-label="Remove">
                ✕
              </button>
            </form>
          </li>
        ))}
        {items.length === 0 && <li className="px-3 py-4 text-sm text-muted">No exercises yet. Search below to add some.</li>}
      </ul>

      {available.length > 0 ? (
        <ExercisePicker listId={listId} exercises={available} addAction={addExerciseToList} />
      ) : (
        <p className="text-sm text-muted">
          No exercises to add. <Link href="/import" className="text-accent">Import your Setgraph export</Link> first.
        </p>
      )}

      <details className="rounded-2xl bg-card p-3">
        <summary className="cursor-pointer text-sm font-semibold text-muted">List settings</summary>
        <form action={updateList} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="id" value={list.id} />
          <input name="name" defaultValue={list.name} required />
          <textarea name="notes" defaultValue={list.notes ?? ""} placeholder="Notes (warm-up, cues, progression…)" rows={3} />
          <ColorPicker value={list.color} />
          <button className="rounded-xl bg-accent px-3 py-2 font-semibold text-black">Save</button>
        </form>
      </details>
    </div>
  );
}
