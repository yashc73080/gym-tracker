import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/auth";

export default async function ExercisesPage() {
  const userId = await requireUserId();
  const rows = await db
    .select({
      id: schema.exercises.id,
      name: schema.exercises.name,
      muscles: schema.exercises.muscleGroups,
      setCount: sql<number>`(select count(*)::int from sets s where s.exercise_id = "exercises"."id")`,
      last: sql<string | null>`(select max(performed_at)::text from sets s where s.exercise_id = "exercises"."id")`,
    })
    .from(schema.exercises)
    .where(eq(schema.exercises.userId, userId))
    .orderBy(asc(schema.exercises.name));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold">Exercises</h1>
        <span className="text-muted">{rows.length}</span>
      </header>
      {rows.length === 0 ? (
        <p className="rounded-2xl bg-card p-6 text-muted">No exercises yet. Import your Setgraph export first.</p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl bg-card">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/exercises/${r.id}`} className="flex items-center justify-between gap-3 px-3 py-3 hover:bg-card2">
              <div className="min-w-0">
                <p className="truncate">{r.name}</p>
                <p className="truncate text-sm text-muted">{r.muscles.join(", ") || "No muscle set"}</p>
              </div>
              <div className="shrink-0 text-right text-sm text-muted">
                <p>{r.setCount} sets</p>
                <p>{r.last?.slice(0, 10)}</p>
              </div>
              <span className="text-muted">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
