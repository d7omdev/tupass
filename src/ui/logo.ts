// "TUPASS" block-art wordmark (originally generated as hardcoded-gray ANSI art;
// kept here as a plain █/space grid so it recolors with the active theme).
const LOGO: readonly string[] = [
  "████████████  ████    ████  ████████████  ████████████  ████████████  ████████████",
  "    ████      ████    ████  ████    ████  ████    ████  ████    ████  ████    ████",
  "    ████      ████    ████  ████    ████  ████    ████  ████          ████        ",
  "    ████      ████    ████  ████████████  ████████████  ████████████  ████████████",
  "    ████      ████    ████  ████          ████    ████          ████          ████",
  "    ████      ████    ████  ████          ████    ████  ████    ████  ████    ████",
  "    ████      ████████████  ████          ████    ████  ████████████  ████████████",
];

// Quarter-size variant: downscale 2×2 pixels into a single cell using Unicode
// quadrant blocks, halving BOTH width and height (~81×7 → ~41×4). Indexed by
// the 4-bit mask (top-left, top-right, bottom-left, bottom-right).
const QUADRANTS = [
  " ", "▗", "▖", "▄", "▝", "▐", "▞", "▟", "▘", "▚", "▌", "▙", "▀", "▜", "▛", "█",
];
function quarter(rows: readonly string[]): string[] {
  const width = Math.max(...rows.map((r) => r.length));
  const on = (r: number, c: number) => (rows[r]?.[c] ?? " ") === "█";
  const out: string[] = [];
  for (let r = 0; r < rows.length; r += 2) {
    let line = "";
    for (let c = 0; c < width; c += 2) {
      const mask =
        (on(r, c) ? 8 : 0) | (on(r, c + 1) ? 4 : 0) | (on(r + 1, c) ? 2 : 0) | (on(r + 1, c + 1) ? 1 : 0);
      line += QUADRANTS[mask];
    }
    out.push(line.trimEnd() || " ");
  }
  return out;
}

export const LOGO_SMALL: readonly string[] = quarter(LOGO);
/** Display width of the small wordmark (widest row), for fit checks. */
export const LOGO_SMALL_WIDTH = Math.max(...LOGO_SMALL.map((l) => l.length));

// Start column of the nth glyph (0-based), found by the blank-column gaps
// between letters — lets callers two-tone the wordmark without a magic number.
function glyphStart(rows: readonly string[], n: number): number {
  const width = Math.max(...rows.map((r) => r.length));
  const blank = (c: number) => rows.every((r) => (r[c] ?? " ") === " ");
  let seen = -1;
  let prevBlank = true;
  for (let c = 0; c < width; c++) {
    const b = blank(c);
    if (!b && prevBlank && ++seen === n) return c;
    prevBlank = b;
  }
  return width;
}
/** Column in LOGO_SMALL where "PASS" begins (3rd glyph), for the TU/PASS split. */
export const LOGO_SMALL_SPLIT = glyphStart(LOGO_SMALL, 2);
