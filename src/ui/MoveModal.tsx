// Destination-folder picker for the move (M) action. A navigable list of every
// existing folder, plus "(root)" and a "+ new folder…" escape hatch that hands
// off to the text-input modal. Navigation is driven by App (mode "move").

import { Modal } from "./Modal";
import { Hint } from "./Hint";
import { theme, ICON } from "./theme";

/** value: "" = store root, a path = that folder, null = create a new folder. */
export interface MoveOption {
  label: string;
  value: string | null;
}

const VISIBLE = 10;

interface Props {
  leaf: string;
  options: MoveOption[];
  index: number;
}

export function MoveModal({ leaf, options, index }: Props) {
  const start = windowStart(index, options.length, VISIBLE);
  const slice = options.slice(start, start + VISIBLE);

  return (
    <Modal title={`move ${leaf}`} accent={theme.accent} width={64}>
      <Hint items={[["↑↓", "choose"], ["󰌑", "move here"], ["esc", "cancel"]]} />
      <box style={{ flexDirection: "column", marginTop: 1 }}>
        {slice.map((o, i) => (
          <Row key={o.label} opt={o} selected={start + i === index} />
        ))}
      </box>
      <text style={{ fg: theme.textDim, marginTop: 1 }}>
        {index + 1}/{options.length}
      </text>
    </Modal>
  );
}

function Row({ opt, selected }: { opt: MoveOption; selected: boolean }) {
  const isNew = opt.value === null;
  const icon = isNew ? "+" : ICON.folderClosed;
  const textFg = selected ? theme.selectText : isNew ? theme.good : theme.text;
  const iconFg = selected ? theme.selectText : isNew ? theme.good : theme.accent;

  return (
    <box
      style={{
        width: "100%",
        height: 1,
        flexDirection: "row",
        backgroundColor: selected ? theme.selectBg : undefined,
      }}
    >
      <text style={{ fg: iconFg }}>{` ${icon} `}</text>
      <text style={{ fg: textFg }}>{opt.label}</text>
    </box>
  );
}

/** Keep the selected index inside a sliding window of the given size. */
function windowStart(selected: number, length: number, size: number): number {
  if (length <= size) return 0;
  let start = selected - Math.floor(size / 2);
  if (start < 0) start = 0;
  if (start + size > length) start = length - size;
  return start;
}
