// Bundled color schemes, sourced from the well-known kitty terminal themes.
//
// Each scheme is declared compactly as a `ThemeSpec` (background, foreground and
// the 16 ANSI colors — exactly what a kitty `.conf` theme file carries). The
// richer set of UI slots the app actually paints (panel elevation, dim text,
// borders, selection…) is *derived* from those primitives in `buildPalette`, so
// the catalog stays faithful to the original palettes and trivial to extend.

import { RGBA } from "@opentui/core";
import type { ResolvedPalette } from "./theme";

interface ThemeSpec {
  id: string;
  name: string;
  kind: "dark" | "light";
  bg: string;
  fg: string;
  /** ANSI 0..15: black,red,green,yellow,blue,magenta,cyan,white, + bright. */
  ansi: [
    string, string, string, string, string, string, string, string,
    string, string, string, string, string, string, string, string,
  ];
  /** Optional signature accent; defaults to ANSI blue (4). */
  accent?: string;
}

// ── Catalog ─────────────────────────────────────────────────────────────────
const SPECS: ThemeSpec[] = [
  {
    id: "catppuccin-mocha",
    name: "Catppuccin Mocha",
    kind: "dark",
    bg: "#1e1e2e",
    fg: "#cdd6f4",
    accent: "#cba6f7",
    ansi: [
      "#45475a", "#f38ba8", "#a6e3a1", "#f9e2af", "#89b4fa", "#f5c2e7", "#94e2d5", "#bac2de",
      "#585b70", "#f38ba8", "#a6e3a1", "#f9e2af", "#89b4fa", "#f5c2e7", "#94e2d5", "#a6adc8",
    ],
  },
  {
    id: "dracula",
    name: "Dracula",
    kind: "dark",
    bg: "#282a36",
    fg: "#f8f8f2",
    accent: "#bd93f9",
    ansi: [
      "#21222c", "#ff5555", "#50fa7b", "#f1fa8c", "#bd93f9", "#ff79c6", "#8be9fd", "#f8f8f2",
      "#6272a4", "#ff6e6e", "#69ff94", "#ffffa5", "#d6acff", "#ff92df", "#a4ffff", "#ffffff",
    ],
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    kind: "dark",
    bg: "#1a1b26",
    fg: "#c0caf5",
    accent: "#7aa2f7",
    ansi: [
      "#15161e", "#f7768e", "#9ece6a", "#e0af68", "#7aa2f7", "#bb9af7", "#7dcfff", "#a9b1d6",
      "#414868", "#f7768e", "#9ece6a", "#e0af68", "#7aa2f7", "#bb9af7", "#7dcfff", "#c0caf5",
    ],
  },
  {
    id: "nord",
    name: "Nord",
    kind: "dark",
    bg: "#2e3440",
    fg: "#d8dee9",
    accent: "#88c0d0",
    ansi: [
      "#3b4252", "#bf616a", "#a3be8c", "#ebcb8b", "#81a1c1", "#b48ead", "#88c0d0", "#e5e9f0",
      "#4c566a", "#bf616a", "#a3be8c", "#ebcb8b", "#81a1c1", "#b48ead", "#8fbcbb", "#eceff4",
    ],
  },
  {
    id: "gruvbox-dark",
    name: "Gruvbox Dark",
    kind: "dark",
    bg: "#282828",
    fg: "#ebdbb2",
    accent: "#fabd2f",
    ansi: [
      "#282828", "#cc241d", "#98971a", "#d79921", "#458588", "#b16286", "#689d6a", "#a89984",
      "#928374", "#fb4934", "#b8bb26", "#fabd2f", "#83a598", "#d3869b", "#8ec07c", "#ebdbb2",
    ],
  },
  {
    id: "rose-pine",
    name: "Rosé Pine",
    kind: "dark",
    bg: "#191724",
    fg: "#e0def4",
    accent: "#c4a7e7",
    ansi: [
      "#26233a", "#eb6f92", "#31748f", "#f6c177", "#9ccfd8", "#c4a7e7", "#ebbcba", "#e0def4",
      "#6e6a86", "#eb6f92", "#31748f", "#f6c177", "#9ccfd8", "#c4a7e7", "#ebbcba", "#e0def4",
    ],
  },
  {
    id: "everforest-dark",
    name: "Everforest Dark",
    kind: "dark",
    bg: "#2d353b",
    fg: "#d3c6aa",
    accent: "#a7c080",
    ansi: [
      "#475258", "#e67e80", "#a7c080", "#dbbc7f", "#7fbbb3", "#d699b6", "#83c092", "#d3c6aa",
      "#475258", "#e67e80", "#a7c080", "#dbbc7f", "#7fbbb3", "#d699b6", "#83c092", "#d3c6aa",
    ],
  },
  {
    id: "kanagawa",
    name: "Kanagawa",
    kind: "dark",
    bg: "#1f1f28",
    fg: "#dcd7ba",
    accent: "#7e9cd8",
    ansi: [
      "#16161d", "#c34043", "#76946a", "#c0a36e", "#7e9cd8", "#957fb8", "#6a9589", "#c8c093",
      "#727169", "#e82424", "#98bb6c", "#e6c384", "#7fb4ca", "#938aa9", "#7aa89f", "#dcd7ba",
    ],
  },
  {
    id: "solarized-dark",
    name: "Solarized Dark",
    kind: "dark",
    bg: "#002b36",
    fg: "#93a1a1",
    accent: "#268bd2",
    ansi: [
      "#073642", "#dc322f", "#859900", "#b58900", "#268bd2", "#d33682", "#2aa198", "#eee8d5",
      "#586e75", "#cb4b16", "#859900", "#657b83", "#839496", "#6c71c4", "#93a1a1", "#fdf6e3",
    ],
  },
  {
    id: "catppuccin-latte",
    name: "Catppuccin Latte",
    kind: "light",
    bg: "#eff1f5",
    fg: "#4c4f69",
    accent: "#8839ef",
    ansi: [
      "#5c5f77", "#d20f39", "#40a02b", "#df8e1d", "#1e66f5", "#ea76cb", "#179299", "#acb0be",
      "#6c6f85", "#d20f39", "#40a02b", "#df8e1d", "#1e66f5", "#ea76cb", "#179299", "#bcc0cc",
    ],
  },
  {
    id: "solarized-light",
    name: "Solarized Light",
    kind: "light",
    bg: "#fdf6e3",
    fg: "#586e75",
    accent: "#268bd2",
    ansi: [
      "#073642", "#dc322f", "#859900", "#b58900", "#268bd2", "#d33682", "#2aa198", "#eee8d5",
      "#002b36", "#cb4b16", "#859900", "#657b83", "#839496", "#6c71c4", "#93a1a1", "#fdf6e3",
    ],
  },
  {
    id: "github-light",
    name: "GitHub Light",
    kind: "light",
    bg: "#ffffff",
    fg: "#24292e",
    accent: "#0366d6",
    ansi: [
      "#24292e", "#d73a49", "#28a745", "#dbab09", "#0366d6", "#5a32a3", "#1b7c83", "#6a737d",
      "#959da5", "#cb2431", "#22863a", "#b08800", "#005cc5", "#5a32a3", "#3192aa", "#d1d5da",
    ],
  },
];

// ── Color math (operate on #rrggbb strings, convert once at the end) ──────────
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function toHex(rgb: [number, number, number]): string {
  return (
    "#" +
    rgb
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
      .join("")
  );
}

/** Linear blend: t=0 → a, t=1 → b. */
function mix(a: string, b: string, t: number): string {
  const A = parseHex(a);
  const B = parseHex(b);
  return toHex([
    A[0] + (B[0] - A[0]) * t,
    A[1] + (B[1] - A[1]) * t,
    A[2] + (B[2] - A[2]) * t,
  ]);
}

/**
 * Expand a kitty-style spec into the full set of UI slots the app paints.
 * Panel elevation and borders are blended from bg→fg so they read as subtle
 * depth on both dark and light schemes.
 */
export function buildPalette(spec: ThemeSpec): ResolvedPalette {
  const { bg, fg, ansi } = spec;
  const accent = spec.accent ?? ansi[4];
  const hex = (s: string) => RGBA.fromHex(s);

  return {
    bg: hex(bg),
    panel: hex(mix(bg, fg, 0.04)),
    panelAlt: hex(mix(bg, fg, 0.08)),

    text: hex(fg),
    textDim: hex(mix(fg, bg, 0.5)),

    // Whisper-thin borders: just enough to define an edge, never to shout.
    border: hex(mix(bg, fg, 0.13)),
    borderFocus: hex(accent),
    accent: hex(accent),

    // Folders + labels take the theme's cyan so structure reads by hue;
    // entries stay foreground.
    folder: hex(ansi[6]),
    entry: hex(fg),

    good: hex(ansi[2]),
    warn: hex(ansi[3]),
    danger: hex(ansi[1]),
    otp: hex(accent),

    key: hex(ansi[6]),
    value: hex(fg),

    // Selection = inverse video: the row's bg becomes the foreground color and
    // its text becomes the background color.
    selectBg: hex(fg),
    selectText: hex(bg),

    // Light drop shadow — only a hair below the base bg, so it lifts the block
    // without a heavy black edge.
    shadow: hex(mix(bg, "#000000", 0.18)),

    // Modal surface — noticeably darker than the panes so dialogs read as focused.
    overlay: hex(mix(bg, "#000000", 0.3)),
  };
}

// ── Picker entries ────────────────────────────────────────────────────────────
export interface ThemeEntry {
  id: string;
  name: string;
  kind: "auto" | "dark" | "light";
  /** null for the "auto" entry, which follows the live terminal palette. */
  palette: ResolvedPalette | null;
  /** A small strip of representative colors for the picker preview. */
  swatch: RGBA[];
}

function swatchOf(p: ResolvedPalette): RGBA[] {
  return [p.bg, p.text, p.accent, p.danger, p.warn, p.good, p.otp, p.folder];
}

const BUNDLED: ThemeEntry[] = SPECS.map((spec) => {
  const palette = buildPalette(spec);
  return { id: spec.id, name: spec.name, kind: spec.kind, palette, swatch: swatchOf(palette) };
});

/** The "Terminal (auto)" entry comes first so it stays the discoverable default. */
export const THEME_ENTRIES: ThemeEntry[] = [
  { id: "auto", name: "Terminal (auto)", kind: "auto", palette: null, swatch: [] },
  ...BUNDLED,
];

export const ENTRY_BY_ID: Record<string, ThemeEntry> = Object.fromEntries(
  THEME_ENTRIES.map((e) => [e.id, e]),
);
