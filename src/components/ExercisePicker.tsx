"use client";

import { useState } from "react";

export type PickerExercise = { id: string; name: string; muscles: string[] };

export function ExercisePicker({
  listId,
  exercises,
  addAction,
}: {
  listId: string;
  exercises: PickerExercise[];
  addAction: (formData: FormData) => void | Promise<void>;
}) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const matches = exercises
    .filter((e) => !needle || e.name.toLowerCase().includes(needle) || e.muscles.some((m) => m.toLowerCase().includes(needle)))
    .slice(0, 40);

  return (
    <div className="flex flex-col gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search exercises or muscles to add…"
        className="w-full"
      />
      {needle && (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-card">
          {matches.map((e) => (
            <li key={e.id}>
              <form action={addAction}>
                <input type="hidden" name="listId" value={listId} />
                <input type="hidden" name="exerciseId" value={e.id} />
                <button className="flex w-full items-center justify-between px-3 py-3 text-left">
                  <span>
                    {e.name}
                    <span className="ml-2 text-sm text-muted">{e.muscles[0]}</span>
                  </span>
                  <span className="text-accent">＋</span>
                </button>
              </form>
            </li>
          ))}
          {matches.length === 0 && <li className="px-3 py-3 text-sm text-muted">No matching exercises</li>}
        </ul>
      )}
    </div>
  );
}
