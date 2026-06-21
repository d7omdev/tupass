// A centered overlay container. OpenTUI renders children in document order, so
// placing this absolutely-positioned box last in the tree draws it on top of
// the panes beneath.

import type { ReactNode } from "react";
import { useTerminalDimensions } from "@opentui/react";
import { TextAttributes, RGBA, type ColorInput } from "@opentui/core";
import { theme } from "./theme";
import { capitalize } from "./text";

/** Yoga dimension accepted by OpenTUI box width/height. */
type Dimension = number | "auto" | `${number}%`;

// Translucent scrim: dims the panes behind the dialog while leaving them
// visible (alpha-blended over whatever is already drawn).
const SCRIM = RGBA.fromValues(0, 0, 0, 0.45);

interface Props {
  title: string;
  width?: Dimension;
  height?: Dimension;
  children: ReactNode;
  accent?: ColorInput;
}

export function Modal({ title, width = 60, height, children, accent = theme.accent }: Props) {
  // Responsive: on small screens dialogs go full width; otherwise a numeric
  // width is clamped to the terminal and percentage widths self-scale.
  const { width: termWidth } = useTerminalDimensions();
  const narrow = termWidth < 80;
  const w: Dimension = narrow
    ? "100%"
    : typeof width === "number"
      ? Math.min(width, Math.max(24, termWidth - 4))
      : width;
  return (
    <box
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        backgroundColor: SCRIM,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Flat, borderless card — no drop shadow. Darker than the panel panes
          (uses the darkest palette slot) so the dialog reads as recessed/focused. */}
      <box
        style={{
          width: w,
          height,
          backgroundColor: theme.overlay,
          flexDirection: "column",
          paddingTop: 1,
          paddingBottom: 1,
          paddingLeft: 2,
          paddingRight: 2,
        }}
      >
        <text style={{ fg: accent, attributes: TextAttributes.BOLD, marginBottom: 1 }}>
          {capitalize(title)}
        </text>
        {children}
      </box>
    </box>
  );
}
