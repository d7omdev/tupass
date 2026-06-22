// Repository over the `pass` CLI. Every password-store operation the TUI
// supports funnels through here, so the UI never shells out directly.
//
// All entry names are passed as discrete argv elements (see exec.ts) — never
// interpolated into a shell string — so a name like "$(rm -rf ~)" is inert.

import { run } from "./exec";
import { storeDir } from "./store";
import type { ExecResult } from "../types";

const PASS = "pass";

/** Decrypt and return the full secret text for an entry. */
export async function show(name: string): Promise<string> {
  // Explicit `show` subcommand so a name starting with "-" isn't parsed as a flag.
  const r = await run(PASS, ["show", name]);
  if (r.code !== 0) throw new PassError(r.stderr || `failed to show ${name}`);
  return r.stdout;
}

/**
 * Copy a field to the clipboard via `pass -c`, which auto-clears after
 * PASSWORD_STORE_CLIP_TIME seconds (default 45). `line` is 1-based; line 1 is
 * the password.
 */
export async function copy(name: string, line = 1): Promise<void> {
  const args = line > 1 ? ["-c", String(line), name] : ["-c", name];
  // detach: `pass -c` leaves a 45s clipboard-clear daemon holding the pipes;
  // resolve on exit instead of waiting for that to finish. See run()/RunOptions.
  const r = await run(PASS, args, { detach: true });
  if (r.code !== 0) throw new PassError(r.stderr || "clipboard copy failed");
}

export interface GenerateOpts {
  length?: number;
  noSymbols?: boolean;
  inPlace?: boolean; // replace only the first line of an existing entry
  force?: boolean; // overwrite without prompting
}

/** Generate a new password for `name`. Returns the generated value. */
export async function generate(name: string, opts: GenerateOpts = {}): Promise<string> {
  const args = ["generate"];
  if (opts.noSymbols) args.push("-n");
  // pass treats --in-place and --force as mutually exclusive:
  //   [--in-place,-i | --force,-f]
  // Prefer in-place when updating an existing entry (keeps its other lines);
  // otherwise force-overwrite.
  if (opts.inPlace) args.push("-i");
  else if (opts.force) args.push("-f");
  args.push(name);
  if (opts.length) args.push(String(opts.length));

  const r = await run(PASS, args);
  if (r.code !== 0) throw new PassError(r.stderr || "generate failed");
  // pass prints the password on the last non-empty line, wrapped in color codes.
  const clean = stripAnsi(r.stdout).trim().split("\n");
  return clean[clean.length - 1] ?? "";
}

/**
 * Create or overwrite an entry with multi-line content via `pass insert -m`.
 * Used for both "add new" and "edit" (we send the full edited buffer).
 */
export async function insertMultiline(name: string, content: string, force = true): Promise<void> {
  const args = ["insert", "-m"];
  if (force) args.push("-f");
  args.push(name);
  const stdin = content.endsWith("\n") ? content : content + "\n";
  const r = await run(PASS, args, { stdin });
  if (r.code !== 0) throw new PassError(r.stderr || "insert failed");
}

export async function remove(name: string): Promise<void> {
  // -f skips the interactive confirm; the TUI confirms beforehand. -r removes
  // folders recursively when name resolves to a directory.
  const r = await run(PASS, ["rm", "-r", "-f", name]);
  if (r.code !== 0) throw new PassError(r.stderr || "remove failed");
}

export async function rename(from: string, to: string): Promise<void> {
  const r = await run(PASS, ["mv", "-f", from, to]);
  if (r.code !== 0) throw new PassError(r.stderr || "rename failed");
}

export async function copyEntry(from: string, to: string): Promise<void> {
  const r = await run(PASS, ["cp", "-f", from, to]);
  if (r.code !== 0) throw new PassError(r.stderr || "copy failed");
}

/** `pass find` — search entry names. Returns matching pass-names. */
export async function find(query: string): Promise<string[]> {
  const r = await run(PASS, ["find", query]);
  // `pass find` prints a tree; we instead reuse the in-memory filter in the UI.
  // This is kept for parity / future use.
  return stripAnsi(r.stdout)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Generate a TOTP code for an entry (requires the pass-otp extension). */
export async function otp(name: string): Promise<string> {
  const r = await run(PASS, ["otp", name]);
  if (r.code !== 0) throw new PassError(r.stderr || "otp failed (is pass-otp installed?)");
  return stripAnsi(r.stdout).trim();
}

/** Pass-through to `pass git <args...>` running inside the store. */
export async function git(args: string[]): Promise<ExecResult> {
  return run(PASS, ["git", ...args], { cwd: storeDir() });
}

export async function isGitRepo(): Promise<boolean> {
  const r = await run("git", ["rev-parse", "--is-inside-work-tree"], { cwd: storeDir() });
  return r.code === 0 && r.stdout.trim() === "true";
}

export async function hasOtpExtension(): Promise<boolean> {
  const r = await run(PASS, ["otp", "--help"]);
  return r.code === 0 || /usage|otpauth/i.test(r.stdout + r.stderr);
}

export class PassError extends Error {}

/** Strip ANSI color codes pass uses when stdout is a TTY-ish pipe. */
export function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}
