import { defineConfig } from "vite";

// A TUI runs in Node/Bun, not a browser, so Vite is configured for an SSR-style
// Node bundle: it produces a single runnable `dist/tupass.js` with a shebang.
// `vite build` becomes the production packaging step; day-to-day we run the
// source directly with Bun (see the `dev` script) for instant startup.
// Vite reads `jsx`/`jsxImportSource` from tsconfig.json, so esbuild already
// emits the OpenTUI automatic runtime — no explicit esbuild block needed.
export default defineConfig({
  build: {
    target: "esnext",
    ssr: true,
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: "src/index.tsx",
      output: {
        format: "esm",
        entryFileNames: "tupass.js",
        // Preserve the shebang so the artifact is directly executable.
        banner: "#!/usr/bin/env node",
      },
      // Native deps + the runtime stay external; they resolve at run time.
      external: [/^node:/, "@opentui/core", "@opentui/react", "react", "react-reconciler"],
    },
  },
});
