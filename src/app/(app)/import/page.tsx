"use client";

import { startTransition, useActionState, useRef, useState } from "react";
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

const fileKey = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;
const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export default function ImportPage() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importAction, null);
  const [files, setFiles] = useState<File[]>([]);
  const picker = useRef<HTMLInputElement>(null);
  const s = state?.summary;

  // Files live in React state, so Preview then Import reuses them without choosing again.
  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((cur) => {
      const seen = new Set(cur.map(fileKey));
      return [...cur, ...[...list].filter((f) => !seen.has(fileKey(f)))];
    });
    if (picker.current) picker.current.value = "";
  };

  const submit = (intent: "preview" | "commit") => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    fd.set("intent", intent);
    startTransition(() => action(fd));
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Import</h1>
      <p className="text-muted">
        Export from Setgraph and add both files here: the set export and the sessions export.
        Re-importing the full history is safe: unchanged rows are left alone, edited rows are updated, new ones are added, nothing is deleted.
      </p>

      <section className="flex flex-col gap-3 rounded-2xl bg-card p-4">
        <input ref={picker} type="file" accept=".csv,text/csv" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
        <button type="button" onClick={() => picker.current?.click()} className="rounded-xl bg-card2 py-3 font-semibold">
          {files.length ? "Add more files" : "Choose CSV files"}
        </button>

        {files.length > 0 && (
          <ul className="divide-y divide-line rounded-xl bg-card2">
            {files.map((f) => (
              <li key={fileKey(f)} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="text-sm text-muted">{kb(f.size)}</span>
                <button
                  type="button"
                  onClick={() => setFiles((cur) => cur.filter((x) => x !== f))}
                  className="rounded-lg px-2 py-1 text-red-400 hover:bg-card"
                  aria-label={`Remove ${f.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <button type="button" onClick={() => submit("preview")} disabled={pending || files.length === 0} className="flex-1 rounded-xl bg-card2 py-3 font-semibold disabled:opacity-50">
            {pending ? "Working…" : "Preview"}
          </button>
          <button type="button" onClick={() => submit("commit")} disabled={pending || files.length === 0} className="flex-1 rounded-xl bg-accent py-3 font-semibold text-black disabled:opacity-50">
            Import
          </button>
        </div>
      </section>

      {state?.error && <p className="break-words rounded-2xl bg-red-500/15 p-4 text-red-400">{state.error}</p>}

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
