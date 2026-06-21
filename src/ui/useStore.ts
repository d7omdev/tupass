// Loads the store tree and exposes the flattened, filtered view the tree pane
// renders. Keeps expand/collapse state and selection index in one place.

import { useCallback, useMemo, useState } from "react";
import { listEntries, buildTree, flatten } from "../lib/store";
import type { FlatRow, FolderNode } from "../types";

export function useStore() {
  const [entries, setEntries] = useState<string[]>(() => listEntries());
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState("");

  const reload = useCallback(() => {
    setEntries(listEntries());
  }, []);

  // When filtering, auto-expand every folder so matches are visible and build
  // the tree only from matching entries.
  const tree: FolderNode = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const matched = q ? entries.filter((e) => e.toLowerCase().includes(q)) : entries;
    return buildTree(matched);
  }, [entries, filter]);

  const rows: FlatRow[] = useMemo(() => {
    if (filter.trim()) {
      // Expand all folders in the filtered tree.
      const all = collectFolderPaths(tree);
      return flatten(tree, all);
    }
    return flatten(tree, expanded);
  }, [tree, expanded, filter]);

  const toggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpanded(collectFolderPaths(tree));
  }, [tree]);

  /** Ensure every ancestor folder of `path` is expanded (so it's visible). */
  const expandTo = useCallback((path: string) => {
    const segments = path.split("/");
    setExpanded((prev) => {
      const next = new Set(prev);
      let accum = "";
      for (let i = 0; i < segments.length - 1; i++) {
        accum = accum ? `${accum}/${segments[i]}` : segments[i]!;
        next.add(accum);
      }
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  // Every folder path in the store (unfiltered), sorted — used by the move
  // picker as the list of possible destinations.
  const folders = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      const segs = e.split("/");
      let accum = "";
      for (let i = 0; i < segs.length - 1; i++) {
        accum = accum ? `${accum}/${segs[i]}` : segs[i]!;
        set.add(accum);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  return {
    rows,
    filter,
    setFilter,
    reload,
    toggle,
    expandAll,
    collapseAll,
    expandTo,
    expanded,
    folders,
    count: entries.length,
  };
}

function collectFolderPaths(folder: FolderNode, acc = new Set<string>()): Set<string> {
  for (const c of folder.children) {
    if (c.kind === "folder") {
      acc.add(c.path);
      collectFolderPaths(c, acc);
    }
  }
  return acc;
}
