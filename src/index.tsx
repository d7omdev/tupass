// Entry point: boot the OpenTUI renderer and mount the app.

import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { App } from "./App";
import { storeExists, storeDir } from "./lib/store";

async function main() {
  if (!storeExists()) {
    process.stderr.write(
      `\nNo password store found at ${storeDir()}.\n` +
        `Initialize one with:  pass init <gpg-id>\n\n`,
    );
    process.exit(1);
  }

  const renderer = await createCliRenderer();
  const root = createRoot(renderer);

  const shutdown = () => {
    root.unmount();
    // Restore the terminal to a sane state before exiting.
    renderer.destroy();
    process.exit(0);
  };

  root.render(<App onExit={shutdown} />);

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`\nfatal: ${msg}\n`);
  process.exit(1);
});
