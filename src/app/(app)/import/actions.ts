"use server";

import { requireUserId } from "@/lib/auth";
import { runImport, type ImportSummary } from "@/lib/import/run";

export type ImportState = { summary?: ImportSummary; error?: string } | null;

const MAX_BYTES = 8 * 1024 * 1024;

export async function importAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const userId = await requireUserId();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Choose at least one CSV file." };
  if (files.some((f) => f.size > MAX_BYTES)) return { error: "A file is larger than 8 MB." };
  const commit = formData.get("intent") === "commit";
  try {
    const texts = await Promise.all(files.map(async (f) => ({ name: f.name, text: await f.text() })));
    return { summary: await runImport(userId, texts, commit) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Import failed." };
  }
}
