// Bottom bar: three segments on one responsive row.
//   left   — a small status chip (icon + state) on a darker background
//   center — the flash / busy message (colored by kind); when idle, a rotating
//            keyboard tip with the KEY highlighted apart from its description
//   right  — a compact hint + the help key
//
// Responsive: on narrow terminals the side segments collapse to icons/keys so
// the center always has room.

import { useEffect, useState } from "react";
import { useTerminalDimensions } from "@opentui/react";
import { TextAttributes } from "@opentui/core";
import { theme, ICON } from "./theme";

export type ToastKind = "info" | "good" | "warn" | "danger";

// Nerd Font lightbulb — marks a rotating idle tip without spending a word on it.
const TIP_ICON = "";

interface Props {
  /** Non-null while a slow op is running (its label is the flash text). */
  busy: string | null;
  /** Current spinner frame (shown in the chip while busy). */
  spinner: string;
  toast: { msg: string; kind: ToastKind } | null;
}

// Rotating idle tips. Key is rendered in the accent; description stays dim.
const TIPS: { k: string; d: string }[] = [
  { k: "t", d: "switch theme" },
  { k: "/", d: "search entries" },
  { k: "a", d: "add entry" },
  { k: "g", d: "generate password" },
  { k: "M", d: "move to a folder" },
  { k: "e", d: "edit entry" },
  { k: "?", d: "all keybindings" },
];

function colorFor(kind: ToastKind): typeof theme.good {
  if (kind === "good") return theme.good;
  if (kind === "warn") return theme.warn;
  if (kind === "danger") return theme.danger;
  return theme.accent;
}

export function StatusBar({ busy, spinner, toast }: Props) {
  const { width } = useTerminalDimensions();
  const narrow = width < 64;

  // Cycle the idle tip every few seconds.
  const [tipIdx, setTipIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTipIdx((i) => (i + 1) % TIPS.length), 4500);
    return () => clearInterval(id);
  }, []);

  const statusIcon = busy ? spinner : ICON.key;
  const statusLabel = busy ? "busy" : "ready";
  const statusColor = busy ? theme.warn : theme.good;

  const flash = busy ?? toast?.msg ?? null;
  const flashColor = busy ? theme.accent : toast ? colorFor(toast.kind) : theme.textDim;
  const tip = TIPS[tipIdx]!;

  return (
    <box style={{ width: "100%", height: 1, flexDirection: "row", backgroundColor: theme.panel }}>
      {/* left: status chip on a darker background */}
      <box
        style={{
          flexDirection: "row",
          backgroundColor: theme.overlay,
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <text style={{ fg: statusColor, attributes: TextAttributes.BOLD }}>{statusIcon}</text>
        {!narrow && <text style={{ fg: statusColor }}>{` ${statusLabel}`}</text>}
      </box>

      {/* center: flash message, or a rotating tip when idle */}
      <box
        style={{
          flexGrow: 1,
          flexDirection: "row",
          justifyContent: "center",
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        {flash !== null ? (
          <text style={{ fg: flashColor }}>{flash}</text>
        ) : (
          <text>
            <span style={{ fg: theme.warn }}>{`${TIP_ICON}  `}</span>
            <span style={{ fg: theme.accent, attributes: TextAttributes.BOLD }}>{tip.k}</span>
            <span style={{ fg: theme.textDim }}>{` ${tip.d}`}</span>
          </text>
        )}
      </box>

      {/* right: hint + help key (key highlighted) */}
      <box style={{ flexDirection: "row", paddingLeft: 1, paddingRight: 1 }}>
        {!narrow && (
          <text>
            <span style={{ fg: theme.accent, attributes: TextAttributes.BOLD }}>q</span>
            <span style={{ fg: theme.textDim }}> quit  </span>
          </text>
        )}
        <text style={{ fg: theme.accent, attributes: TextAttributes.BOLD }}>?</text>
        {!narrow && <text style={{ fg: theme.textDim }}> help</text>}
      </box>
    </box>
  );
}
