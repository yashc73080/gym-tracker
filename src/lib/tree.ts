export type FolderRow = { id: string; parentId: string | null; name: string; color: string | null; sort: number };
export type ListRow = { id: string; folderId: string | null; name: string; color: string | null; sort: number; exerciseCount: number };
export type FolderNode = FolderRow & { folders: FolderNode[]; lists: ListRow[] };

const bySort = <T extends { sort: number; name: string }>(a: T, b: T) =>
  a.sort - b.sort || a.name.localeCompare(b.name);

/** Nest folders and lists. Rows whose parent is missing (or part of a cycle) surface at the top level. */
export function buildTree(folders: FolderRow[], lists: ListRow[]) {
  const nodes = new Map<string, FolderNode>(folders.map((f) => [f.id, { ...f, folders: [], lists: [] }]));
  const roots: FolderNode[] = [];
  for (const n of nodes.values()) {
    const parent = n.parentId ? nodes.get(n.parentId) : undefined;
    if (parent && !isAncestor(nodes, n.id, parent.id)) parent.folders.push(n);
    else roots.push(n);
  }
  const rootLists: ListRow[] = [];
  for (const l of lists) {
    const parent = l.folderId ? nodes.get(l.folderId) : undefined;
    (parent ? parent.lists : rootLists).push(l);
  }
  const sortDeep = (ns: FolderNode[]) => {
    ns.sort(bySort);
    ns.forEach((n) => {
      n.lists.sort(bySort);
      sortDeep(n.folders);
    });
  };
  sortDeep(roots);
  rootLists.sort(bySort);
  return { folders: roots, lists: rootLists };
}

// True when `candidateAncestor` is `id` itself or a descendant of it (so attaching would form a cycle).
function isAncestor(nodes: Map<string, FolderNode>, id: string, candidateParentId: string) {
  let cur: string | null | undefined = candidateParentId;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    if (cur === id) return true;
    seen.add(cur);
    cur = nodes.get(cur)?.parentId;
  }
  return false;
}
