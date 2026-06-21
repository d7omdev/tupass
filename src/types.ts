// Shared domain types for the pass TUI.

/** A node in the password-store hierarchy. */
export type TreeNode = FolderNode | EntryNode;

export interface FolderNode {
  kind: "folder";
  /** Display label (last path segment). */
  name: string;
  /** Full pass path, e.g. "social/twitter". Empty string for the synthetic root. */
  path: string;
  children: TreeNode[];
}

export interface EntryNode {
  kind: "entry";
  name: string;
  /** Full pass name used with the `pass` CLI, e.g. "social/twitter". */
  path: string;
}

/** A single visible line in the flattened tree view. */
export interface FlatRow {
  node: TreeNode;
  depth: number;
  /** Only meaningful for folders. */
  expanded: boolean;
}

/** A parsed decrypted secret. */
export interface Secret {
  /** First line — the password itself. */
  password: string;
  /** `key: value` metadata lines parsed out of the body. */
  fields: SecretField[];
  /** Remaining free-form body lines (notes). */
  notes: string[];
  /** The raw decrypted text, kept for editing. */
  raw: string;
}

export interface SecretField {
  key: string;
  value: string;
}

/** Result of running a `pass` subprocess. */
export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
}
