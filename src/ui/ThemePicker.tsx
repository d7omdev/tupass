// Live theme switcher. Navigation re-applies the highlighted palette to the
// global `theme` immediately, so the whole UI — including this very modal —
// recolors in realtime as you move. Enter commits & persists; Esc reverts.

import { Modal } from "./Modal";
import { Hint } from "./Hint";
import { theme } from "./theme";
import type { ThemeEntry } from "./themes";

const VISIBLE = 9;
const NAME_WIDTH = 20;

interface Props {
  entries: ThemeEntry[];
  index: number;
}

export function ThemePicker({ entries, index }: Props) {
  const start = windowStart(index, entries.length, VISIBLE);
  const slice = entries.slice(start, start + VISIBLE);

  return (
    <Modal title="themes · live preview" accent={theme.accent} width={64}>
      <Hint items={[["↑↓", "preview"], ["󰌑", "apply"], ["esc", "cancel"]]} />
      <box style={{ flexDirection: "column", marginTop: 1 }}>
        {slice.map((e, i) => (
          <Row key={e.id} entry={e} selected={start + i === index} />
        ))}
      </box>
      <text style={{ fg: theme.textDim, marginTop: 1 }}>
        {entries.length} themes · {index + 1}/{entries.length}
      </text>
    </Modal>
  );
}

function Row({ entry, selected }: { entry: ThemeEntry; selected: boolean }) {
  const nameFg = selected ? theme.selectText : theme.text;
  const metaFg = theme.textDim;

  return (
    <box
      style={{
        width: "100%",
        height: 1,
        flexDirection: "row",
        backgroundColor: selected ? theme.selectBg : undefined,
      }}
    >
      <text style={{ fg: nameFg }}>{" " + pad(entry.name, NAME_WIDTH)}</text>
      {entry.swatch.length > 0 ? (
        <box style={{ flexDirection: "row" }}>
          {entry.swatch.map((c, i) => (
            <box key={i} style={{ width: 2, height: 1, backgroundColor: c }} />
          ))}
        </box>
      ) : (
        <text style={{ fg: metaFg }}>follows your terminal</text>
      )}
      <text style={{ fg: metaFg }}>{tag(entry.kind)}</text>
    </box>
  );
}

function tag(kind: ThemeEntry["kind"]): string {
  if (kind === "light") return "  ○ light";
  if (kind === "dark") return "  ● dark";
  return "  ↻ auto";
}

function pad(s: string, width: number): string {
  return s.length >= width ? s.slice(0, width) : s + " ".repeat(width - s.length);
}

/** Keep the selected index inside a sliding window of the given size. */
function windowStart(selected: number, length: number, size: number): number {
  if (length <= size) return 0;
  let start = selected - Math.floor(size / 2);
  if (start < 0) start = 0;
  if (start + size > length) start = length - size;
  return start;
}
