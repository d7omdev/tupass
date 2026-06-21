// Filesystem view of the password store.
//
// Listing entries by walking the store directory for *.gpg files is instant and
// requires no decryption — far faster than asking gpg to enumerate. Decryption
// happens lazily, only when an entry is opened (see pass.ts).

import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { TreeNode, FolderNode, EntryNode } from "../types";

/** Resolve the active store directory, honoring PASSWORD_STORE_DIR. */
export function storeDir(): string {
  return process.env.PASSWORD_STORE_DIR || join(homedir(), ".password-store");
}

export function storeExists(): boolean {
  return existsSync(storeDir());
}

/**
 * Recursively collect every entry's pass-name (path without the `.gpg`
 * suffix), e.g. "social/twitter". Hidden files and the `.git` / `.gpg-id`
 * metadata are skipped.
 */
export function listEntries(dir = storeDir(), prefix = ""): string[] {
  let out: string[] = [];
  let dirents;
  try {
    dirents = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const d of dirents) {
    if (d.name.startsWith(".")) continue; // .git, .gpg-id, dotfiles
    const full = join(dir, d.name);
    if (d.isDirectory()) {
      out = out.concat(listEntries(full, prefix ? `${prefix}/${d.name}` : d.name));
    } else if (d.isFile() && d.name.endsWith(".gpg")) {
      const base = d.name.slice(0, -4);
      out.push(prefix ? `${prefix}/${base}` : base);
    }
  }
  return out;
}

/**
 * Build a sorted nested tree from a flat list of pass-names. Folders sort
 * before entries, then alphabetically — matching how `pass` itself prints.
 */
export function buildTree(names: string[]): FolderNode {
  const root: FolderNode = { kind: "folder", name: "", path: "", children: [] };

  for (const name of names) {
    const segments = name.split("/");
    let cursor = root;
    let accum = "";

    segments.forEach((seg, i) => {
      accum = accum ? `${accum}/${seg}` : seg;
      const isLeaf = i === segments.length - 1;

      if (isLeaf) {
        const entry: EntryNode = { kind: "entry", name: seg, path: accum };
        cursor.children.push(entry);
        return;
      }

      let next = cursor.children.find(
        (c): c is FolderNode => c.kind === "folder" && c.name === seg,
      );
      if (!next) {
        next = { kind: "folder", name: seg, path: accum, children: [] };
        cursor.children.push(next);
      }
      cursor = next;
    });
  }

  sortTree(root);
  return root;
}

function sortTree(folder: FolderNode): void {
  folder.children.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const c of folder.children) {
    if (c.kind === "folder") sortTree(c);
  }
}

/** Flatten the tree into rows the UI can render, respecting collapsed folders. */
export function flatten(
  root: FolderNode,
  expanded: Set<string>,
): { node: TreeNode; depth: number; expanded: boolean }[] {
  const rows: { node: TreeNode; depth: number; expanded: boolean }[] = [];

  const walk = (nodes: TreeNode[], depth: number) => {
    for (const node of nodes) {
      if (node.kind === "folder") {
        const isOpen = expanded.has(node.path);
        rows.push({ node, depth, expanded: isOpen });
        if (isOpen) walk(node.children, depth + 1);
      } else {
        rows.push({ node, depth, expanded: false });
      }
    }
  };

  walk(root.children, 0);
  return rows;
}
