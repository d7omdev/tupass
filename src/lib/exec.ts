// Thin async wrapper around child processes for invoking `pass` / `git`.
//
// We deliberately avoid a shell so user-controlled entry names can never be
// interpreted as shell syntax (no injection surface). Arguments are passed as
// an argv array straight to execFile.

import { execFile, spawn } from "node:child_process";
import type { ExecResult } from "../types";

export interface RunOptions {
  /** Text piped to the process stdin (used for `pass insert -m`, etc.). */
  stdin?: string;
  /** Extra environment overrides merged onto process.env. */
  env?: Record<string, string>;
  /** Working directory. */
  cwd?: string;
  /** Hard timeout in ms; the child is killed and an error is returned. */
  timeoutMs?: number;
  /**
   * Resolve as soon as the process EXITS, ignoring stdout/stderr entirely.
   * Required for `pass -c`: it spawns a background process that sleeps
   * PASSWORD_STORE_CLIP_TIME (45s) to clear the clipboard, and that child
   * inherits our stdout/stderr pipes — so the normal "wait for pipe EOF" path
   * would block for the full 45s. We only need the exit code here.
   */
  detach?: boolean;
}

const DEFAULT_TIMEOUT_MS = 120_000;

/**
 * Run a command and resolve with its captured output. Never rejects on a
 * non-zero exit code — the caller inspects `code` and `stderr` so we can show
 * friendly errors in the UI instead of crashing the renderer.
 *
 * stdin is ALWAYS closed: either we write the provided input and end it, or we
 * end it immediately. Leaving the pipe open lets a child that unexpectedly
 * reads stdin (e.g. an overwrite prompt) block forever. A timeout is the
 * backstop for genuinely-interactive children (e.g. a TTY pinentry).
 */
export function run(cmd: string, args: string[], opts: RunOptions = {}): Promise<ExecResult> {
  // Detached path: stdout/stderr are ignored so no forked grandchild (the
  // clipboard-clear daemon) can keep our pipes open. We resolve on `exit`,
  // which fires when the *direct* child exits regardless of any background
  // descendants it left running.
  if (opts.detach) {
    return new Promise((resolve) => {
      const child = spawn(cmd, args, {
        env: { ...process.env, ...opts.env },
        cwd: opts.cwd,
        detached: true,
        stdio: ["pipe", "ignore", "ignore"],
      });
      child.on("error", () => resolve({ code: 1, stdout: "", stderr: "failed to launch" }));
      child.on("exit", (code) => resolve({ code: code ?? 0, stdout: "", stderr: "" }));
      if (opts.stdin !== undefined) child.stdin?.write(opts.stdin);
      child.stdin?.end();
      child.unref(); // don't keep the event loop (or app exit) waiting on it
    });
  }

  return new Promise((resolve) => {
    const child = execFile(
      cmd,
      args,
      {
        env: { ...process.env, ...opts.env },
        cwd: opts.cwd,
        maxBuffer: 16 * 1024 * 1024,
        encoding: "utf8",
        timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        killSignal: "SIGTERM",
      },
      (error, stdout, stderr) => {
        const killed =
          (error && (error as NodeJS.ErrnoException & { killed?: boolean }).killed) || false;
        resolve({
          code: killed ? 124 : error && typeof error.code === "number" ? error.code : error ? 1 : 0,
          stdout: stdout ?? "",
          stderr: killed
            ? `${stderr ?? ""}\ntimed out — a passphrase prompt may be waiting (check your gpg pinentry)`.trim()
            : stderr ?? "",
        });
      },
    );

    // Always close stdin so children never block on an empty open pipe.
    if (opts.stdin !== undefined) child.stdin?.write(opts.stdin);
    child.stdin?.end();
  });
}
