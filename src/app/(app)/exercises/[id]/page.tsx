import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/auth";
import { MUSCLES } from "@/lib/muscles";
import {
  bestByReps,
  dailyPoints,
  dayLabel,
  findPrs,
  fmt,
  groupByDay,
  timeLabel,
  type SetRow,
} from "@/lib/stats";
import { ProgressChart } from "@/components/ProgressChart";
import { updateExerciseMuscles } from "../actions";

const TABS = [
  { id: "sets", label: "Sets" },
  { id: "chart", label: "Chart" },
  { id: "1rm", label: "1RM" },
  { id: "prs", label: "PRs" },
] as const;

const num = (v: string | string[] | undefined) => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

export default async function ExercisePage({ params, searchParams }: PageProps<"/exercises/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const userId = await requireUserId();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [ex] = await db
    .select()
    .from(schema.exercises)
    .where(and(eq(schema.exercises.id, id), eq(schema.exercises.userId, userId)));
  if (!ex) notFound();

  const tab = TABS.find((t) => t.id === sp.tab)?.id ?? "sets";
  const [minReps, maxReps, minWeight, maxWeight] = ["minReps", "maxReps", "minWeight", "maxWeight"].map((k) => num(sp[k]));

  const rows = await db
    .select()
    .from(schema.sets)
    .where(and(eq(schema.sets.exerciseId, id), eq(schema.sets.userId, userId)))
    .orderBy(asc(schema.sets.performedAt));
  const all: SetRow[] = rows.map((r) => ({
    id: r.id,
    performedAt: r.performedAt,
    reps: r.reps == null ? null : Number(r.reps),
    weight: r.weightLb == null ? null : Number(r.weightLb),
    durationS: r.durationS,
    note: r.note,
  }));

  // PRs are judged against full history; filters only narrow what is shown.
  const prs = findPrs(all);
  const filtered = all.filter(
    (s) =>
      (minReps == null || (s.reps ?? 0) >= minReps) &&
      (maxReps == null || (s.reps ?? 0) <= maxReps) &&
      (minWeight == null || (s.weight ?? 0) >= minWeight) &&
      (maxWeight == null || (s.weight ?? 0) <= maxWeight),
  );
  const filtering = [minReps, maxReps, minWeight, maxWeight].some((v) => v != null);
  const today = new Date().toISOString().slice(0, 10);
  const hasWeight = all.some((s) => (s.weight ?? 0) > 0);
  const hasReps = all.some((s) => s.reps != null);
  const hasDuration = all.some((s) => s.durationS != null);

  const href = (t: string) => {
    const q = new URLSearchParams();
    q.set("tab", t);
    for (const k of ["minReps", "maxReps", "minWeight", "maxWeight"]) if (typeof sp[k] === "string" && sp[k]) q.set(k, sp[k] as string);
    return `/exercises/${id}?${q}`;
  };

  const chartMetrics = [
    ...(hasWeight ? (["maxWeight"] as const) : []),
    ...(hasReps ? (["totalReps"] as const) : []),
    ...(hasWeight && hasReps ? (["volume"] as const) : []),
    "sets" as const,
    ...(hasDuration ? (["durationS"] as const) : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-3">
        <Link href="/exercises" className="rounded-full bg-card px-3 py-2" aria-label="Back to exercises">‹</Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold">{ex.name}</h1>
          <p className="truncate text-sm text-muted">{ex.muscleGroups.join(", ") || "No muscle set"}</p>
        </div>
        <span className="text-sm text-muted">{all.length} sets</span>
      </header>

      <nav className="flex gap-2">
        {TABS.filter((t) => t.id !== "1rm" || (hasWeight && hasReps)).map((t) => (
          <Link
            key={t.id}
            href={href(t.id)}
            className={`rounded-full px-4 py-2 text-sm ${t.id === tab ? "bg-foreground font-semibold text-background" : "bg-card text-muted"}`}
          >
            {t.id === "prs" ? "🏆 PRs" : t.label}
          </Link>
        ))}
      </nav>

      {(tab === "sets" || tab === "chart") && (
        <form className="flex flex-wrap items-end gap-2 text-sm" action={`/exercises/${id}`}>
          <input type="hidden" name="tab" value={tab} />
          {hasReps && (
            <>
              <label className="flex flex-col gap-1 text-muted">Reps
                <span className="flex gap-1">
                  <input name="minReps" defaultValue={minReps ?? ""} placeholder="min" inputMode="numeric" className="w-16" />
                  <input name="maxReps" defaultValue={maxReps ?? ""} placeholder="max" inputMode="numeric" className="w-16" />
                </span>
              </label>
            </>
          )}
          {hasWeight && (
            <label className="flex flex-col gap-1 text-muted">Weight (lb)
              <span className="flex gap-1">
                <input name="minWeight" defaultValue={minWeight ?? ""} placeholder="min" inputMode="decimal" className="w-16" />
                <input name="maxWeight" defaultValue={maxWeight ?? ""} placeholder="max" inputMode="decimal" className="w-16" />
              </span>
            </label>
          )}
          {(hasReps || hasWeight) && (
            <>
              <button className="rounded-xl bg-card2 px-3 py-2 font-semibold">Filter</button>
              {filtering && <Link href={`/exercises/${id}?tab=${tab}`} className="px-2 py-2 text-accent">Clear</Link>}
            </>
          )}
        </form>
      )}

      {tab === "sets" && (
        <div className="flex flex-col gap-4">
          {groupByDay(filtered, prs).map((g) => (
            <section key={g.day}>
              <h2 className="px-1 pb-2 text-lg font-semibold text-muted">{dayLabel(g.day, today)}</h2>
              <ul className="divide-y divide-line rounded-2xl bg-card">
                {g.sets.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-3 py-3">
                    <span className="w-5 text-sm text-muted">{s.n}</span>
                    <span className="w-20 text-sm text-muted">{timeLabel(s.performedAt)}</span>
                    <span className="w-6 text-yellow-400">{s.pr ? "🏆" : ""}</span>
                    <span className="flex flex-1 flex-wrap items-baseline justify-end gap-x-4 text-xl">
                      {s.reps != null && <span className="text-accent">{fmt(s.reps)} <small className="text-sm">rep</small></span>}
                      {(s.weight ?? 0) > 0 && <span className="text-orange-400">{fmt(s.weight!)} <small className="text-sm">lb</small></span>}
                      {s.durationS != null && <span className="text-yellow-400">{fmt(s.durationS)} <small className="text-sm">s</small></span>}
                    </span>
                    {s.note && <span className="max-w-[30%] truncate text-sm text-muted" title={s.note}>{s.note}</span>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {filtered.length === 0 && <p className="rounded-2xl bg-card p-6 text-muted">{filtering ? "No sets match this filter." : "No sets logged."}</p>}
        </div>
      )}

      {tab === "chart" && <ProgressChart points={dailyPoints(filtered)} metrics={chartMetrics} />}

      {tab === "1rm" && (
        <div className="flex flex-col gap-4">
          <ProgressChart points={dailyPoints(all)} metrics={["e1rm"]} />
          <p className="text-sm text-muted">Estimated with the Epley formula: weight × (1 + reps ÷ 30), best set of each day.</p>
        </div>
      )}

      {tab === "prs" && (
        <div className="flex flex-col gap-5">
          <section>
            <h2 className="px-1 pb-2 text-lg font-semibold text-muted">Personal records</h2>
            <ul className="divide-y divide-line rounded-2xl bg-card">
              {all.filter((s) => prs.has(s.id)).reverse().map((s) => (
                <li key={s.id} className="flex items-center justify-between px-3 py-3">
                  <span className="text-sm text-muted">{dayLabel(s.performedAt.slice(0, 10), today)}</span>
                  <span className="text-lg">
                    {s.reps != null && <span className="text-accent">{fmt(s.reps)} rep </span>}
                    {(s.weight ?? 0) > 0 && <span className="text-orange-400">{fmt(s.weight!)} lb </span>}
                    {s.durationS != null && <span className="text-yellow-400">{fmt(s.durationS)} s</span>}
                  </span>
                </li>
              ))}
            </ul>
            <p className="px-1 pt-2 text-sm text-muted">A set is a PR when no earlier set matched or beat it on weight, reps and duration.</p>
          </section>
          {hasWeight && hasReps && (
            <section>
              <h2 className="px-1 pb-2 text-lg font-semibold text-muted">Best weight by reps</h2>
              <ul className="divide-y divide-line rounded-2xl bg-card">
                {bestByReps(all).map((b) => (
                  <li key={b.reps} className="flex items-center justify-between px-3 py-3">
                    <span className="text-accent">{b.reps} rep</span>
                    <span className="text-orange-400">{fmt(b.weight)} lb</span>
                    <span className="text-sm text-muted">{b.at.slice(0, 10)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <details className="rounded-2xl bg-card p-3">
        <summary className="cursor-pointer text-sm font-semibold text-muted">Muscles worked</summary>
        <form action={updateExerciseMuscles} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="id" value={ex.id} />
          <div className="flex flex-wrap gap-2">
            {MUSCLES.map((m) => (
              <label key={m} className="cursor-pointer">
                <input type="checkbox" name="muscle" value={m} defaultChecked={ex.muscleGroups.includes(m)} className="peer sr-only" />
                <span className="block rounded-full bg-card2 px-3 py-1 text-sm text-muted peer-checked:bg-accent peer-checked:font-semibold peer-checked:text-black">{m}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted">Muscles keep their current order; newly ticked ones go last. The first is the primary muscle.</p>
          <button className="rounded-xl bg-accent px-3 py-2 font-semibold text-black">Save muscles</button>
        </form>
      </details>
    </div>
  );
}
