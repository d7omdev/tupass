// The right pane: renders the currently selected entry's decrypted secret,
// with the password masked until the user reveals it. Metadata fields and notes
// are shown structured. OTP entries get a live-generated code on demand.

import type { ReactNode } from "react";
import { useTerminalDimensions } from "@opentui/react";
import { TextAttributes, type ColorInput } from "@opentui/core";
import { theme, ICON } from "./theme";
import { Hint } from "./Hint";
import { LOGO } from "./logo";
import type { Secret, TreeNode } from "../types";

// The block wordmark is ~81 cols wide; only render it when the detail pane is
// wide enough to hold it, otherwise a compact text wordmark.
const LOGO_WIDTH = 81;

interface Props {
  /** Row currently under the cursor (folder, entry, or nothing). */
  node: TreeNode | null;
  secret: Secret | null;
  loading: boolean;
  error: string | null;
  revealed: boolean;
  otpCode: string | null;
}

export function Detail({ node, secret, loading, error, revealed, otpCode }: Props) {
  const { width } = useTerminalDimensions();
  // Detail pane is the ~66% flex side; estimate its inner width for logo fit.
  const showLogo = Math.round(width * 0.66) - 6 >= LOGO_WIDTH;
  const header = node ? (node.kind === "folder" ? `${node.name}/` : node.path) : null;
  return (
    // Outer = the shadow; inner = the flat panel surface.
    <box
      style={{
        flexGrow: 1,
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
        {header && (
          <text style={{ fg: theme.accent, attributes: TextAttributes.BOLD, marginBottom: 1 }}>
            {header}
          </text>
        )}
        {renderBody({ node, secret, loading, error, revealed, otpCode }, showLogo)}
      </box>
    </box>
  );
}

/** Centered placeholder used for the splash, folder guidance, and locked entries. */
function Centered({ children }: { children: ReactNode }) {
  return (
    <box
      style={{
        flexGrow: 1,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </box>
  );
}

function renderBody(
  { node, secret, loading, error, revealed, otpCode }: Omit<Props, "height">,
  showLogo: boolean,
) {
  // Nothing under the cursor → splash.
  if (!node) {
    return (
      <Centered>
        {showLogo ? (
          LOGO.map((line, i) => (
            <text key={i} style={{ fg: theme.accent }}>{line}</text>
          ))
        ) : (
          <text style={{ fg: theme.accent, attributes: TextAttributes.BOLD }}>tupass</text>
        )}
        <text style={{ fg: theme.textDim, marginTop: 1 }}>
          a terminal UI for pass · 󰌑 to open an entry
        </text>
      </Centered>
    );
  }

  // A folder is highlighted → explain what can be done with it.
  if (node.kind === "folder") {
    return (
      <Centered>
        <text style={{ fg: theme.folder, attributes: TextAttributes.BOLD }}>
          {`${ICON.folderClosed}  ${node.name}`}
        </text>
        <text style={{ fg: theme.textDim, marginTop: 1 }}>folder</text>
        <box style={{ marginTop: 1 }}>
          <Hint
            items={[
              ["→", "expand"],
              ["a", "add entry"],
              ["r", "rename"],
              ["M", "move"],
              ["d", "delete"],
            ]}
          />
        </box>
      </Centered>
    );
  }

  if (loading) {
    return <text style={{ fg: theme.warn }}>Decrypting…</text>;
  }
  if (error) {
    return <text style={{ fg: theme.danger }}>{error}</text>;
  }

  // An entry that hasn't been decrypted yet → tell the user how to open it.
  if (!secret) {
    return (
      <Centered>
        <text style={{ fg: theme.warn, attributes: TextAttributes.BOLD }}>
          {`${ICON.key}  encrypted`}
        </text>
        <text style={{ fg: theme.textDim, marginTop: 1 }}>this entry is locked</text>
        <box style={{ marginTop: 1 }}>
          <Hint items={[["󰌑", "open"], ["c", "copy password"], ["e", "edit"]]} />
        </box>
      </Centered>
    );
  }

  const masked = "•".repeat(Math.max(8, Math.min(secret.password.length, 24)));

  return (
    <box style={{ flexDirection: "column", flexGrow: 1 }}>
      {/* Aligned icon · label · value rows */}
      <Field
        icon=""
        label="password"
        value={revealed ? secret.password : masked}
        valueFg={revealed ? theme.good : theme.textDim}
        bold={revealed}
      />
      {otpCode && <Field icon="" label="otp" value={otpCode} valueFg={theme.otp} bold />}
      {secret.fields.map((f, i) => (
        <Field
          key={i}
          icon={fieldIcon(f.key)}
          label={f.key.toLowerCase()}
          value={maskField(f.key, f.value, revealed)}
          valueFg={theme.value}
        />
      ))}

      {secret.notes.length > 0 && (
        <box style={{ flexDirection: "column", marginTop: 1 }}>
          <text style={{ fg: theme.key, attributes: TextAttributes.BOLD }}>{"  notes"}</text>
          {secret.notes.map((n, i) => (
            <text key={i} style={{ fg: theme.text }}>{`   ${n}`}</text>
          ))}
        </box>
      )}

      {/* Actions pinned to the bottom of the pane */}
      <box style={{ flexGrow: 1 }} />
      <Hint
        items={[
          ["c", "copy"],
          ["C", "field"],
          ["s", revealed ? "hide" : "show"],
          ["o", "otp"],
          ["e", "edit"],
        ]}
      />
    </box>
  );
}

// One aligned row: colored icon · dim label · value.
function Field({
  icon,
  label,
  value,
  valueFg,
  bold = false,
}: {
  icon: string;
  label: string;
  value: string;
  valueFg: ColorInput;
  bold?: boolean;
}) {
  return (
    <box style={{ flexDirection: "row" }}>
      <text style={{ fg: theme.accent }}>{`${icon}  `}</text>
      <text style={{ fg: theme.textDim }}>{pad(label)}</text>
      <text style={{ fg: valueFg, attributes: bold ? TextAttributes.BOLD : undefined }}>{value}</text>
    </box>
  );
}

// Pick a Nerd Font icon by what the field looks like.
function fieldIcon(key: string): string {
  const k = key.toLowerCase();
  if (/otp|2fa|totp/.test(k)) return ""; // clock
  if (/pass|secret|pin/.test(k)) return ""; // key
  if (/mail|email/.test(k)) return ""; // envelope
  if (/user|login|account|name/.test(k)) return ""; // person
  if (/url|site|web|host|link|domain/.test(k)) return ""; // link
  return ""; // generic
}

const KEY_WIDTH = 10;
function pad(key: string): string {
  const k = key.length > KEY_WIDTH - 1 ? key.slice(0, KEY_WIDTH - 1) : key;
  return (k + " ".repeat(KEY_WIDTH)).slice(0, KEY_WIDTH);
}

// Mask anything that looks secret (otpauth secret, anything named *secret/token).
function maskField(key: string, value: string, revealed: boolean): string {
  const sensitive = /secret|token|otpauth/i.test(key) || value.includes("otpauth://");
  if (sensitive && !revealed) return "••••••••";
  return value;
}
