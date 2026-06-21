// The left pane: a scrollable, collapsible tree of the password store.
//
// OpenTUI's <select> is flat, so we render the tree ourselves: each visible
// FlatRow becomes a full-width box (for the selection highlight) holding an
// indented text line. We window the rows around the cursor so arbitrarily large
// stores stay responsive and the selection is always on screen.

import { Fragment } from "react";
import { TextAttributes } from "@opentui/core";
import { theme, ICON, darken } from "./theme";
import { capitalize } from "./text";
import { InlineDetail } from "./InlineDetail";
import type { FlatRow, Secret } from "../types";

/** Opened-entry state for the inline (narrow-layout) preview. */
export interface InlineData {
  secret: Secret | null;
  loading: boolean;
  error: string | null;
  revealed: boolean;
  otpCode: string | null;
}

interface Props {
  rows: FlatRow[];
  selectedIndex: number;
  height: number;
  focused: boolean;
  filter: string;
  total: number;
  /** Pane width — "34%" beside the detail pane, "100%" in single-column mode. */
  paneWidth?: number | `${number}%` | "auto";
  /** When set (narrow layout), the selected entry expands inline below its row. */
  inline?: InlineData | null;
}

export function Tree({
  rows,
  selectedIndex,
  height,
  focused,
  filter,
  total,
  paneWidth = "34%",
  inline = null,
}: Props) {
  // Reserve: header (1) + blank gap under header (1) + top/bottom padding (2)
  // + bottom shadow (1) = 5 lines of chrome around the scrollable list.
  const viewport = Math.max(1, height - 5);
  // With an inline preview, anchor the selection near the top so the expanded
  // detail below it stays visible; otherwise center it in the viewport.
  const start = inline
    ? Math.min(Math.max(0, selectedIndex - 1), Math.max(0, rows.length - viewport))
    : windowStart(selectedIndex, rows.length, viewport);
  const slice = rows.slice(start, start + viewport);

  const title = filter
    ? `search · ${filter} (${rows.length}/${total})`
    : `pass · ${total} entries`;

  return (
    // Outer = the shadow: a darker box that peeks out bottom-right.
    <box
      style={{
        width: paneWidth,
        height: "100%",
        backgroundColor: theme.shadow,
        paddingRight: 1,
        paddingBottom: 1,
      }}
    >
      <box
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: theme.panel,
          flexDirection: "column",
          paddingTop: 1,
          paddingBottom: 1,
          paddingLeft: 2,
          paddingRight: 2,
        }}
      >
        <text
          style={{
            fg: focused ? theme.accent : theme.textDim,
            attributes: TextAttributes.BOLD,
            marginBottom: 1,
          }}
        >
          {capitalize(title)}
        </text>
        {rows.length === 0 ? (
          <text style={{ fg: theme.textDim }}> no entries</text>
        ) : (
          slice.map((row, i) => {
            const idx = start + i;
            const sel = idx === selectedIndex;
            const showInline = sel && inline && row.node.kind === "entry";
            return (
              <Fragment key={row.node.path}>
                <Row row={row} selected={sel} />
                {showInline && (
                  <InlineDetail
                    secret={inline.secret}
                    loading={inline.loading}
                    error={inline.error}
                    revealed={inline.revealed}
                    otpCode={inline.otpCode}
                  />
                )}
              </Fragment>
            );
          })
        )}
      </box>
    </box>
  );
}

function Row({ row, selected }: { row: FlatRow; selected: boolean }) {
  const isFolder = row.node.kind === "folder";
  const indent = "  ".repeat(row.depth);
  const marker = isFolder ? (row.expanded ? ICON.folderOpen : ICON.folderClosed) : ICON.entry;
  const label = isFolder ? `${row.node.name}/` : row.node.name;

  // Each row's own colors: folders take the folder hue, entries the foreground.
  const baseFg = isFolder ? theme.folder : theme.text;
  const markerBase = isFolder ? theme.accent : theme.textDim;

  // Selected = inverse video for THIS row: a DARKENED variant of its text color
  // fills the background (full-bright reads too loud), text becomes the pane bg.
  const rowBg = selected ? darken(baseFg) : undefined;
  const labelFg = selected ? theme.panel : baseFg;
  const markerFg = selected ? theme.panel : markerBase;
  const indentFg = selected ? theme.panel : theme.textDim;

  return (
    <box
      style={{
        width: "100%",
        height: 1,
        flexShrink: 0,
        backgroundColor: rowBg,
        flexDirection: "row",
      }}
    >
      <text style={{ fg: indentFg }}>{` ${indent}`}</text>
      <text style={{ fg: markerFg }}>{marker} </text>
      <text style={{ fg: labelFg }}>{label}</text>
    </box>
  );
}

/** Keep the selected index inside a sliding window of the given size. */
function windowStart(selected: number, length: number, size: number): number {
  if (length <= size) return 0;
  const half = Math.floor(size / 2);
  let start = selected - half;
  if (start < 0) start = 0;
  if (start + size > length) start = length - size;
  return start;
}
