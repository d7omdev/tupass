// Modal forms for every mutating action. Each is small and presentational;
// global Escape (cancel) and a few control keys are handled in App, while text
// entry is owned by the focused <input>/<textarea>.

import { useState } from "react";
import type { Ref } from "react";
import type { TextareaRenderable, ColorInput } from "@opentui/core";
import { TextAttributes } from "@opentui/core";
import { Modal } from "./Modal";
import { Hint } from "./Hint";
import { theme, ICON } from "./theme";

// ── Single-line input (rename / new name / search-as-modal) ─────────────────
interface InputModalProps {
  title: string;
  label: string;
  /** Read-only folder prefix shown before the input (locked, like the add form). */
  prefix?: string;
  initial?: string;
  placeholder?: string;
  accent?: ColorInput;
  onSubmit: (value: string) => void;
}

export function InputModal({
  title,
  label,
  prefix = "",
  initial = "",
  placeholder,
  accent,
  onSubmit,
}: InputModalProps) {
  const [value, setValue] = useState(initial);
  return (
    <Modal title={title} accent={accent} width={64}>
      <text style={{ fg: theme.textDim }}>{label}</text>
      <box
        style={{
          marginTop: 1,
          backgroundColor: theme.panelAlt,
          height: 1,
          paddingLeft: 1,
          paddingRight: 1,
          flexDirection: "row",
        }}
      >
        {prefix ? <text style={{ fg: theme.folder }}>{prefix}</text> : null}
        <input
          focused
          value={value}
          placeholder={placeholder}
          onInput={setValue}
          onSubmit={() => onSubmit(value)}
          style={{ flexGrow: 1, focusedBackgroundColor: theme.panelAlt }}
        />
      </box>
      <box style={{ marginTop: 1 }}>
        <Hint items={[["󰌑", "confirm"], ["esc", "cancel"]]} />
      </box>
    </Modal>
  );
}

// ── Confirm (delete) ────────────────────────────────────────────────────────
export function ConfirmModal({ message }: { message: string }) {
  return (
    <Modal title="confirm" accent={theme.danger} width={60}>
      <text style={{ fg: theme.text }}>{message}</text>
      <text style={{ fg: theme.textDim, marginTop: 1 }}>
        <span style={{ fg: theme.danger }}>y</span> delete{" "}
        <span style={{ fg: theme.good }}>n</span> / esc cancel
      </text>
    </Modal>
  );
}

// ── Multi-line editor (add body / edit) ─────────────────────────────────────
interface EditorModalProps {
  title: string;
  initial: string;
  textareaRef: Ref<TextareaRenderable>;
}

export function EditorModal({
  title,
  initial,
  textareaRef,
}: EditorModalProps) {
  return (
    <Modal title={title} width="80%" height="70%" accent={theme.accent}>
      <text style={{ fg: theme.textDim }}>
        line 1 = password · further lines = key: value or notes
      </text>
      <box
        style={{
          marginTop: 1,
          flexGrow: 1,
          backgroundColor: theme.panelAlt,
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <textarea
          ref={textareaRef}
          focused
          initialValue={initial}
          style={{ height: "100%", focusedBackgroundColor: theme.panelAlt }}
        />
      </box>
      <box style={{ marginTop: 1 }}>
        <Hint items={[["ctrl+s", "save"], ["esc", "cancel"]]} />
      </box>
    </Modal>
  );
}

// ── Generate ────────────────────────────────────────────────────────────────
export interface GenerateValues {
  name: string;
  length: number;
  noSymbols: boolean;
}

interface GenerateModalProps {
  initialName: string;
  field: "name" | "length";
  values: GenerateValues;
  onName: (v: string) => void;
  onLength: (v: string) => void;
  onSubmit: () => void;
}

export function GenerateModal({
  field,
  values,
  onName,
  onLength,
  onSubmit,
}: GenerateModalProps) {
  return (
    <Modal title="generate password" accent={theme.good} width={66}>
      <text style={{ fg: theme.textDim }}>entry name</text>
      <box
        style={{
          marginTop: 0,
          backgroundColor: field === "name" ? theme.panelAlt : theme.panel,
          height: 1,
          paddingLeft: 1,
        }}
      >
        <input
          focused={field === "name"}
          value={values.name}
          placeholder="folder/entry"
          onInput={onName}
          onSubmit={onSubmit}
          style={{ flexGrow: 1, focusedBackgroundColor: theme.panelAlt }}
        />
      </box>

      <text style={{ fg: theme.textDim, marginTop: 1 }}>length</text>
      <box
        style={{
          backgroundColor: field === "length" ? theme.panelAlt : theme.panel,
          height: 1,
          paddingLeft: 1,
        }}
      >
        <input
          focused={field === "length"}
          value={String(values.length)}
          onInput={onLength}
          onSubmit={onSubmit}
          style={{ flexGrow: 1, focusedBackgroundColor: theme.panelAlt }}
        />
      </box>

      <box style={{ flexDirection: "row", marginTop: 1 }}>
        <text style={{ fg: values.noSymbols ? theme.warn : theme.good }}>
          {values.noSymbols ? "[ ] symbols" : "[x] symbols"}
        </text>
        <text style={{ fg: theme.textDim }}> (ctrl+t toggle)</text>
      </box>
      <box style={{ marginTop: 1 }}>
        <Hint items={[["tab", "field"], ["󰌑", "generate"], ["ctrl+t", "symbols"], ["esc", "cancel"]]} />
      </box>
    </Modal>
  );
}

// ── Help ────────────────────────────────────────────────────────────────────
const HELP: [string, string][] = [
  ["↑ ↓ / j k", "move selection"],
  ["→ / l / space", "expand folder"],
  ["← / h", "collapse folder"],
  ["enter", "open entry (decrypt)"],
  ["s", "toggle reveal password"],
  ["c", "copy password to clipboard (auto-clears)"],
  ["C", "copy a specific field (login/url…)"],
  ["o", "generate & copy OTP code"],
  ["a", "add new entry"],
  ["g", "generate password"],
  ["e", "edit entry"],
  ["r", "rename file / folder (in place)"],
  ["M", "move to another folder"],
  ["p", "duplicate (copy) entry"],
  ["d", "delete entry"],
  ["/", "fuzzy filter entries"],
  ["t", "switch color theme (live preview)"],
  ["E", "expand all   ·   W collapse all"],
  ["G", "git: sync (pull --rebase + push)"],
  ["L", "git: recent log"],
  ["?", "toggle this help"],
  ["q / ctrl+c", "quit"],
];

// ── Git log ───────────────────────────────────────────────────────────────
interface GitLogModalProps {
  lines: string[];
  /** Index of the first visible line (scroll position). */
  offset: number;
  /** Number of lines the dialog can show at once. */
  viewport: number;
}

export function GitLogModal({ lines, offset, viewport }: GitLogModalProps) {
  const empty = lines.length === 1 && lines[0] === "(no commits yet)";
  const slice = lines.slice(offset, offset + viewport);
  const last = Math.min(offset + viewport, lines.length);
  const atBottom = last >= lines.length;
  return (
    <Modal title="git log" accent={theme.accent} width={84} height="70%">
      <text style={{ fg: theme.textDim, marginBottom: 1 }}>
        {/* Trailing "+" hints that more commits may load on scroll. */}
        {empty ? "no commits yet" : `commits ${offset + 1}–${last} of ${lines.length}${atBottom ? "" : "+"}`}
      </text>
      <box style={{ flexDirection: "column", flexGrow: 1 }}>
        {empty ? (
          <text style={{ fg: theme.textDim }}>this store has no commits.</text>
        ) : (
          slice.map((line, i) => {
            // `git log --oneline` rows are "<hash> <subject>"; tint the hash.
            const sp = line.indexOf(" ");
            const hash = sp > 0 ? line.slice(0, sp) : line;
            const rest = sp > 0 ? line.slice(sp) : "";
            return (
              <text key={offset + i}>
                <span style={{ fg: theme.accent }}>{hash}</span>
                <span style={{ fg: theme.text }}>{rest}</span>
              </text>
            );
          })
        )}
      </box>
      <box style={{ flexDirection: "row", marginTop: 1 }}>
        <Hint items={empty ? [["esc/L", "close"]] : [["j/k", "scroll"], ["esc/L", "close"]]} />
        {!empty && !atBottom ? <text style={{ fg: theme.textDim }}>{"   ↓ more"}</text> : null}
      </box>
    </Modal>
  );
}

export function HelpModal() {
  return (
    <Modal title="keybindings" accent={theme.accent} width={70} height="80%">
      {/* Small wordmark */}
      <box style={{ flexDirection: "row", marginBottom: 1 }}>
        <text style={{ fg: theme.accent, attributes: TextAttributes.BOLD }}>
          {`${ICON.key}  tupass`}
        </text>
        <text style={{ fg: theme.textDim }}>{"   ·   a terminal UI for pass"}</text>
      </box>
      <box style={{ flexDirection: "column" }}>
        {HELP.map(([k, d]) => (
          <box key={k} style={{ flexDirection: "row" }}>
            <text style={{ fg: theme.accent }}>
              {(k + "               ").slice(0, 16)}
            </text>
            <text style={{ fg: theme.text }}>{d}</text>
          </box>
        ))}
      </box>
      <text style={{ fg: theme.textDim, marginTop: 1 }}>esc / ? close</text>
    </Modal>
  );
}
