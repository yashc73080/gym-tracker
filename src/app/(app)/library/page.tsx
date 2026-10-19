import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/auth";
import { hexFor } from "@/lib/colors";
import { buildTree, type FolderNode, type ListRow } from "@/lib/tree";
import { ColorPicker } from "@/components/ColorPicker";
import {
  createFolder,
  buildMuscleLists,
  createList,
  deleteFolder,
  deleteList,
  moveList,
  updateFolder,
  updateList,
} from "./actions";

type Option = { id: string; label: string };

function flattenFolders(nodes: FolderNode[], depth = 0, out: Option[] = []) {
  for (const n of nodes) {
    out.push({ id: n.id, label: `${"— ".repeat(depth)}${n.name}` });
    flattenFolders(n.folders, depth + 1, out);
  }
  return out;
}

function FolderSelect({ name, options, value }: { name: string; options: Option[]; value?: string | null }) {
  return (
    <select name={name} defaultValue={value ?? ""} className="w-full">
      <option value="">Top level</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

const Dot = ({ color }: { color: string | null }) => (
  <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm" style={{ background: hexFor(color) }} />
);

const Menu = ({ children }: { children: React.ReactNode }) => (
  <details className="relative">
    <summary className="cursor-pointer list-none rounded-lg px-2 py-1 text-muted hover:bg-card2" aria-label="Edit">
      ⋯
    </summary>
    <div className="absolute right-0 z-20 mt-1 flex w-72 max-w-[85vw] flex-col gap-3 rounded-2xl border border-line bg-card p-3 shadow-xl">
      {children}
    </div>
  </details>
);

const Btn = ({ danger, children }: { danger?: boolean; children: React.ReactNode }) => (
  <button
    className={`rounded-xl px-3 py-2 text-sm font-semibold ${danger ? "bg-red-500/15 text-red-400" : "bg-accent text-black"}`}
  >
    {children}
  </button>
);

function ListItem({ list, options }: { list: ListRow; options: Option[] }) {
  return (
    <li className="flex items-center gap-3 px-3 py-3">
      <Dot color={list.color} />
      <Link href={`/library/${list.id}`} className="flex-1 truncate">
        {list.name}
      </Link>
      <span className="text-sm text-muted">{list.exerciseCount}</span>
      <Menu>
        <form action={updateList} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={list.id} />
          <input name="name" defaultValue={list.name} required />
          <ColorPicker value={list.color} />
          <Btn>Save</Btn>
        </form>
        <form action={moveList} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={list.id} />
          <FolderSelect name="folderId" options={options} value={list.folderId} />
          <button className="rounded-xl bg-card2 px-3 py-2 text-sm">Move</button>
        </form>
        <form action={deleteList}>
          <input type="hidden" name="id" value={list.id} />
          <Btn danger>Delete list</Btn>
        </form>
      </Menu>
    </li>
  );
}

function FolderItem({ node, options }: { node: FolderNode; options: Option[] }) {
  const count = node.lists.length + node.folders.length;
  return (
    <li>
      <details open className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-3 font-semibold">
          <Dot color={node.color} />
          <span className="flex-1 truncate">{node.name}</span>
          <span className="text-sm font-normal text-muted">{count}</span>
          <span className="text-muted transition group-open:rotate-90">›</span>
        </summary>
        <ul className="ml-4 divide-y divide-line border-l border-line">
          {node.folders.map((f) => (
            <FolderItem key={f.id} node={f} options={options} />
          ))}
          {node.lists.map((l) => (
            <ListItem key={l.id} list={l} options={options} />
          ))}
          {count === 0 && <li className="px-3 py-3 text-sm text-muted">Empty folder</li>}
        </ul>
        <div className="flex justify-end px-3 pb-2">
          <Menu>
            <form action={updateFolder} className="flex flex-col gap-2">
              <input type="hidden" name="id" value={node.id} />
              <input name="name" defaultValue={node.name} required />
              <ColorPicker value={node.color} />
              <Btn>Save folder</Btn>
            </form>
            <form action={createFolder} className="flex flex-col gap-2">
              <input type="hidden" name="parentId" value={node.id} />
              <input name="name" placeholder="New sub-folder" required />
              <button className="rounded-xl bg-card2 px-3 py-2 text-sm">Add sub-folder</button>
            </form>
            <form action={createList} className="flex flex-col gap-2">
              <input type="hidden" name="folderId" value={node.id} />
              <input name="name" placeholder="New list in this folder" required />
              <button className="rounded-xl bg-card2 px-3 py-2 text-sm">Add list</button>
            </form>
            <form action={deleteFolder}>
              <input type="hidden" name="id" value={node.id} />
              <Btn danger>Delete folder (lists move to top level)</Btn>
            </form>
          </Menu>
        </div>
      </details>
    </li>
  );
}

export default async function LibraryPage() {
  const userId = await requireUserId();
  const [folderRows, listRows] = await Promise.all([
    db.select().from(schema.folders).where(eq(schema.folders.userId, userId)),
    db
      .select({
        id: schema.lists.id,
        folderId: schema.lists.folderId,
        name: schema.lists.name,
        color: schema.lists.color,
        sort: schema.lists.sort,
        exerciseCount: sql<number>`(select count(*)::int from list_exercises le where le.list_id = "lists"."id")`,
      })
      .from(schema.lists)
      .where(eq(schema.lists.userId, userId)),
  ]);

  const tree = buildTree(folderRows, listRows);
  const options = flattenFolders(tree.folders);
  const empty = folderRows.length === 0 && listRows.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Library</h1>
        <div className="flex gap-2">
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-xl bg-card px-3 py-2 text-sm font-semibold text-accent">
              + List
            </summary>
            <form action={createList} className="absolute right-0 z-20 mt-1 flex w-72 max-w-[85vw] flex-col gap-2 rounded-2xl border border-line bg-card p-3 shadow-xl">
              <input name="name" placeholder="List name (e.g. git push)" required />
              <FolderSelect name="folderId" options={options} />
              <ColorPicker />
              <Btn>Create list</Btn>
            </form>
          </details>
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-xl bg-card px-3 py-2 text-sm font-semibold text-accent">
              + Folder
            </summary>
            <form action={createFolder} className="absolute right-0 z-20 mt-1 flex w-72 max-w-[85vw] flex-col gap-2 rounded-2xl border border-line bg-card p-3 shadow-xl">
              <input name="name" placeholder="Folder name (e.g. Muscle Groups)" required />
              <FolderSelect name="parentId" options={options} />
              <ColorPicker />
              <Btn>Create folder</Btn>
            </form>
          </details>
        </div>
      </header>

      <form action={buildMuscleLists} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-4">
        <p className="min-w-0 flex-1 text-sm text-muted">
          Auto-build a <b className="text-foreground">Muscle Groups</b> folder with a list per muscle from your imported exercises.
          Safe to run again; new exercises from later imports are added automatically.
        </p>
        <button className="rounded-xl bg-accent px-4 py-2 font-semibold text-black">Build muscle lists</button>
      </form>

      {empty ? (
        <p className="rounded-2xl bg-card p-6 text-muted">
          Nothing here yet. Build the muscle lists above, or create your own folders and lists with the buttons at the top.
          Exercises appear after you <Link href="/import" className="text-accent">import</Link> your Setgraph export.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-visible rounded-2xl bg-card">
          {tree.lists.map((l) => (
            <ListItem key={l.id} list={l} options={options} />
          ))}
          {tree.folders.map((f) => (
            <FolderItem key={f.id} node={f} options={options} />
          ))}
        </ul>
      )}
    </div>
  );
}
