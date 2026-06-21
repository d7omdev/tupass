// Compact, inline preview shown directly beneath the selected entry in the
// single-column (narrow) layout — so the list itself doubles as the detail view
// instead of a separate preview pane. Kept icon-light and self-contained.

import { TextAttributes, type ColorInput } from "@opentui/core";
import { theme } from "./theme";
import { Hint } from "./Hint";
import type { Secret } from "../types";

// Keyboard-return glyph (Nerd Font), built by codepoint to keep the source ASCII.
const ENTER = String.fromCodePoint(0xf0311);
const LABEL_WIDTH = 10;

interface Props {
  secret: Secret | null;
  loading: boolean;
  error: string | null;
  revealed: boolean;
  otpCode: string | null;
}

export function InlineDetail({ secret, loading, error, revealed, otpCode }: Props) {
  if (loading) {
    return (
      <box style={{ flexShrink: 0, paddingLeft: 4 }}>
        <text style={{ fg: theme.warn }}>decrypting…</text>
      </box>
    );
  }
  if (error) {
    return (
      <box style={{ flexShrink: 0, paddingLeft: 4 }}>
        <text style={{ fg: theme.danger }}>{error}</text>
      </box>
    );
  }
  // Not decrypted yet — show the affordance to open it, inline.
  if (!secret) {
    return (
      <box style={{ flexShrink: 0, paddingLeft: 4, paddingBottom: 1 }}>
        <Hint items={[[ENTER, "open"], ["c", "copy"]]} />
      </box>
    );
  }

  const masked = "•".repeat(Math.max(8, Math.min(secret.password.length, 24)));
  return (
    <box style={{ flexShrink: 0, flexDirection: "column", paddingLeft: 4, paddingTop: 1, paddingBottom: 1 }}>
      <Row label="password" value={revealed ? secret.password : masked} fg={revealed ? theme.good : theme.textDim} bold={revealed} />
      {otpCode && <Row label="otp" value={otpCode} fg={theme.otp} bold />}
      {secret.fields.map((f, i) => (
        <Row key={i} label={f.key.toLowerCase()} value={maskField(f.key, f.value, revealed)} fg={theme.value} />
      ))}
      {secret.notes.length > 0 && (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ fg: theme.key }}>notes</text>
          {secret.notes.map((n, i) => (
            <text key={i} style={{ fg: theme.text }}>{`  ${n}`}</text>
          ))}
        </box>
      )}
      <box style={{ marginTop: 1 }}>
        <Hint items={[["c", "copy"], ["s", revealed ? "hide" : "show"], ["o", "otp"], ["e", "edit"]]} />
      </box>
    </box>
  );
}

function Row({ label, value, fg, bold = false }: { label: string; value: string; fg: ColorInput; bold?: boolean }) {
  return (
    <box style={{ flexDirection: "row" }}>
      <text style={{ fg: theme.key }}>{pad(label)}</text>
      <text style={{ fg, attributes: bold ? TextAttributes.BOLD : undefined }}>{value}</text>
    </box>
  );
}

function pad(key: string): string {
  const k = key.length > LABEL_WIDTH - 1 ? key.slice(0, LABEL_WIDTH - 1) : key;
  return (k + " ".repeat(LABEL_WIDTH)).slice(0, LABEL_WIDTH);
}

function maskField(key: string, value: string, revealed: boolean): string {
  const sensitive = /secret|token|otpauth/i.test(key) || value.includes("otpauth://");
  if (sensitive && !revealed) return "••••••••";
  return value;
}
