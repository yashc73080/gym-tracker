"use client";

import { useActionState } from "react";
import { importAction, type ImportState } from "./actions";

const Row = ({ label, c }: { label: string; c?: { total: number; added: number; updated: number; unchanged: number } }) =>
  c ? (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 py-2">
      <span className="font-semibold">{label}</span>
      <span className="text-sm text-muted">
        {c.total} rows · <b className="text-accent">{c.added} new</b> · <b className="text-yellow-400">{c.updated} changed</b> · {c.unchanged} unchanged
      </span>
    </div>
  ) : null;

export default function ImportPage() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importAction, null);
  const s = state?.summary;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Import</h1>
      <p className="text-muted">
        Export from Setgraph (Settings → export) and drop both files here: the set export and the sessions export.
        Re-importing the full history is safe: unchanged rows are left alone, edited rows are updated, new ones are added, nothing is deleted.
      </p>

      <form action={action} className="flex flex-col gap-3 rounded-2xl bg-card p-4">
        <input name="files" type="file" accept=".csv,text/csv" multiple required className="w-full" />
        <div className="flex gap-2">
          <button name="intent" value="preview" disabled={pending} className="flex-1 rounded-xl bg-card2 py-3 font-semibold disabled:opacity-60">
            {pending ? "Working…" : "Preview"}
          </button>
          <button name="intent" value="commit" disabled={pending} className="flex-1 rounded-xl bg-accent py-3 font-semibold text-black disabled:opacity-60">
            Import
          </button>
        </div>
      </form>

      {state?.error && <p className="rounded-2xl bg-red-500/15 p-4 text-red-400">{state.error}</p>}

      {s && (
        <section className="flex flex-col gap-2 rounded-2xl bg-card p-4">
          <h2 className="text-xl font-bold">{s.committed ? "Imported" : "Preview (nothing saved yet)"}</h2>
          <div className="divide-y divide-line">
            <Row label="Sets" c={s.sets} />
            <Row label="Sessions" c={s.sessions} />
          </div>
          {s.newExercises.length > 0 && (
            <p className="text-sm">
              <b>{s.newExercises.length} new exercise{s.newExercises.length > 1 ? "s" : ""}</b>{" "}
              <span className="text-muted">added to your library: {s.newExercises.slice(0, 12).join(", ")}{s.newExercises.length > 12 ? "…" : ""}</span>
            </p>
          )}
          {s.updatedSets.length > 0 && (
            <p className="text-sm text-muted">
              Changed sets include: {s.updatedSets.map((u) => `${u.exercise} (${u.at})`).join("; ")}
            </p>
          )}
          {s.warnings.map((w) => (
            <p key={w} className="text-sm text-yellow-400">{w}</p>
          ))}
        </section>
      )}
    </div>
  );
}
