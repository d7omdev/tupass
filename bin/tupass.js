#!/usr/bin/env node
/* global process, console, URL */
// Universal launcher. Runnable by Node so the shebang never fails on a
// Bun-less machine; hands off to Bun because OpenTUI needs bun:ffi, which
// Node cannot load. No runtime is bundled.

// Already under Bun? Run the app directly.
if (process.versions.bun) {
  await import("../src/index.tsx");
} else {
  // Under Node: find Bun and re-exec, or guide the user to install it.
  const { spawnSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const entry = fileURLToPath(new URL("../src/index.tsx", import.meta.url));

  const result = spawnSync("bun", [entry], { stdio: "inherit" });

  if (result.error?.code === "ENOENT") {
    console.error(
      "\ntupass requires Bun (its TUI renderer uses bun:ffi, which Node can't load).\n\n" +
        "Install Bun, then re-run:\n" +
        "  curl -fsSL https://bun.sh/install | bash\n\n" +
        "Docs: https://bun.sh/docs/installation\n"
    );
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}
