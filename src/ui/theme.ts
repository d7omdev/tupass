// Palette sourced from the terminal's OWN theme.
//
// Two-layer strategy so it works on every terminal:
//   1. Fallback: RGBA.fromIndex(0..15) / default fg+bg — indexed/"default"
//      intent. On non-truecolor terminals these render via the terminal's ANSI
//      palette directly.
//   2. On startup index.tsx detects the terminal palette over OSC and calls
//      applyTerminalPalette(), overwriting these with the terminal's REPORTED
//      RGB. This is what makes truecolor terminals match their theme too
//      (OpenTUI emits 24-bit RGB there and otherwise uses its bundled palette).
//
// `theme` is intentionally a mutable object: applyTerminalPalette() runs before
// the first render, so every component reads the resolved colors.

import { RGBA } from "@opentui/core";
import type { TerminalColors } from "@opentui/core";

/** The full set of UI color slots, all resolved to concrete RGBA values. */
export type ResolvedPalette = Record<keyof typeof theme, RGBA>;

const ANSI = {
  black: 0,
  red: 1,
  green: 2,
  yellow: 3,
  blue: 4,
  magenta: 5,
  cyan: 6,
  white: 7,
  brightBlack: 8,
  brightBlue: 12,
  brightWhite: 15,
} as const;

const idx = (n: number) => RGBA.fromIndex(n);

export const theme = {
  bg: RGBA.defaultBackground(),
  panel: RGBA.defaultBackground(),
  panelAlt: RGBA.defaultBackground(),

  text: RGBA.defaultForeground(),
  textDim: idx(ANSI.brightBlack),

  border: idx(ANSI.brightBlack),
  borderFocus: idx(ANSI.brightBlue),
  accent: idx(ANSI.blue),

  // Folders + field labels carry a hue (cyan) so structure reads by color, not
  // just by glyph — entries stay plain foreground.
  folder: idx(ANSI.cyan),
  entry: RGBA.defaultForeground(),

  good: idx(ANSI.green),
  warn: idx(ANSI.yellow),
  danger: idx(ANSI.red),
  otp: idx(ANSI.magenta),

  key: idx(ANSI.cyan),
  value: RGBA.defaultForeground(),

  // Selection = inverse video: foreground fills the row, background is the text.
  selectBg: RGBA.defaultForeground(),
  selectText: RGBA.defaultBackground(),

  // Faux drop-shadow: a *gentle* step under the base bg (color8), peeking out
  // bottom-right. Deliberately light so blocks lift without a heavy black edge.
  shadow: idx(ANSI.brightBlack),

  // Modal/dialog surface — darker than the panel panes so overlays read as
  // recessed and focused. Falls back to true black on the terminal-auto theme.
  overlay: idx(ANSI.black),
};

// Snapshot of the indexed/default palette, captured before any override. Used to
// restore the "Terminal (auto)" look when switching back from a bundled theme.
const DEFAULTS: ResolvedPalette = { ...theme };

/** Restore the original indexed/default palette (the terminal-native look). */
export function resetTheme(): void {
  Object.assign(theme, DEFAULTS);
}

/** A darker variant of a color (scales RGB toward black). Used for the
 *  selection fill so a row's own hue reads as a muted highlight, not full-bright. */
export function darken(c: RGBA, amount = 0.3): RGBA {
  const [r, g, b] = c.toInts();
  const f = Math.max(0, 1 - amount);
  return RGBA.fromInts(Math.round(r * f), Math.round(g * f), Math.round(b * f), 255);
}

/** Overwrite every slot from a fully-resolved bundled palette. */
export function applyPalette(palette: ResolvedPalette): void {
  Object.assign(theme, palette);
}

/** Parse a terminal-reported color (e.g. "#rrggbb" or "rrggbb") to RGBA. */
function toRGBA(hex: string | null | undefined): RGBA | null {
  if (!hex) return null;
  try {
    return RGBA.fromHex(hex.startsWith("#") ? hex : `#${hex}`);
  } catch {
    return null;
  }
}

/**
 * Overwrite the palette from a detected terminal color set. Each assignment is
 * guarded: any slot the terminal didn't report keeps its indexed fallback.
 */
export function applyTerminalPalette(colors: TerminalColors): void {
  const p = colors.palette ?? [];
  const fg = toRGBA(colors.defaultForeground);
  const bg = toRGBA(colors.defaultBackground);

  if (fg) {
    theme.text = fg;
    theme.entry = fg;
    theme.value = fg;
  }
  if (bg) {
    theme.bg = bg;
    theme.panel = bg;
    theme.panelAlt = bg;
  }

  const set = (key: keyof typeof theme, hex: string | null | undefined) => {
    const c = toRGBA(hex);
    if (c) theme[key] = c;
  };

  set("danger", p[ANSI.red]);
  set("good", p[ANSI.green]);
  set("warn", p[ANSI.yellow]);
  set("accent", p[ANSI.blue]);
  set("otp", p[ANSI.magenta]);
  set("folder", p[ANSI.cyan]);
  set("key", p[ANSI.cyan]);
  set("textDim", p[ANSI.brightBlack]);
  set("border", p[ANSI.brightBlack]);
  set("borderFocus", p[ANSI.brightBlue] ?? p[ANSI.blue]);
  // Inverse-video selection: foreground as bg, background as text.
  if (fg) theme.selectBg = fg;
  if (bg) theme.selectText = bg;
  // Gentle shadow: color8 (a soft gray), not pure black.
  set("shadow", p[ANSI.brightBlack]);
  // Modal surface: true black (color0) — darker than the panes.
  set("overlay", p[ANSI.black]);
}

// Tree + key glyphs (Nerd Font icons).
export const ICON = {
  folderOpen: "",
  folderClosed: "",
  entry: "",
  key: "",
} as const;
