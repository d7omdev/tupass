// Tiny persisted config (currently just the chosen theme id).
//
// Best-effort by design: a read/write failure must never break the TUI, so
// every path swallows errors and falls back to sensible defaults. Stored under
// the XDG config dir (honoring XDG_CONFIG_HOME), separate from the secret store.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

function configDir(): string {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, "tupass");
}

function configFile(): string {
  return join(configDir(), "config.json");
}

export function loadThemeId(): string {
  try {
    const parsed = JSON.parse(readFileSync(configFile(), "utf8")) as { theme?: unknown };
    return typeof parsed.theme === "string" ? parsed.theme : "auto";
  } catch {
    return "auto";
  }
}

export function saveThemeId(id: string): void {
  try {
    mkdirSync(configDir(), { recursive: true });
    writeFileSync(configFile(), JSON.stringify({ theme: id }, null, 2) + "\n");
  } catch {
    /* non-fatal: theme just won't persist */
  }
}
