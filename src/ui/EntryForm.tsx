// Structured add/edit form.
//
// password + confirm are MASKED custom fields: OpenTUI's <input> has no secret
// mode, so App owns their keystrokes and we render dots here. name / login /
// url are normal single-line inputs; notes is a textarea read via ref on save.
// On save the form serializes to pass's positional format (lib/secret.fromForm).

import type { Ref, ReactNode } from "react";
import type { TextareaRenderable } from "@opentui/core";
import { Modal } from "./Modal";
import { Hint } from "./Hint";
import { theme } from "./theme";

export type FormField = "name" | "password" | "confirm" | "username" | "url" | "notes";

interface Props {
  title: string;
  /** Fixed parent folder shown read-only (empty string = store root). */
  folder: string;
  name: string;
  nameEditable: boolean;
  password: string;
  confirm: string;
  username: string;
  url: string;
  initialNotes: string;
  field: FormField;
  reveal: boolean;
  confirmError: string | null;
  nameError: string | null;
  notesRef: Ref<TextareaRenderable>;
  onName: (v: string) => void;
  onUsername: (v: string) => void;
  onUrl: (v: string) => void;
  onSubmit: () => void;
}

export function EntryForm(props: Props) {
  const { folder, name, nameEditable, password, confirm, reveal } = props;
  const masked = (v: string) => (reveal ? v : "•".repeat(v.length));

  return (
    <Modal title={props.title} width="64%" accent={theme.accent}>
      {/* path: read-only folder prefix + (editable) leaf name */}
      <Label text="path" active={props.field === "name"} />
      <box style={{ flexDirection: "row", height: 1, paddingLeft: 1, backgroundColor: theme.panelAlt }}>
        {folder !== "" && <text style={{ fg: theme.folder }}>{folder}/</text>}
        {nameEditable ? (
          <input
            focused={props.field === "name"}
            value={name}
            placeholder="entry-name"
            onInput={props.onName}
            onSubmit={props.onSubmit}
            style={{ flexGrow: 1, focusedBackgroundColor: theme.panelAlt }}
          />
        ) : (
          <text style={{ fg: theme.text }}>{name}</text>
        )}
      </box>
      {props.nameError && <text style={{ fg: theme.danger }}>{props.nameError}</text>}

      {/* password (masked, custom-captured) */}
      <Label text="password" active={props.field === "password"} />
      <SecretField value={masked(password)} active={props.field === "password"} placeholder="type password…" />

      {/* confirm (masked) */}
      <Label text="confirm" active={props.field === "confirm"} />
      <SecretField value={masked(confirm)} active={props.field === "confirm"} placeholder="re-type password…" />
      {props.confirmError ? (
        <text style={{ fg: theme.danger }}>✗ {props.confirmError}</text>
      ) : password !== "" && password === confirm ? (
        <text style={{ fg: theme.good }}>✓ passwords match</text>
      ) : null}

      {/* login */}
      <Label text="login" active={props.field === "username"} />
      <box style={{ height: 1, paddingLeft: 1, backgroundColor: props.field === "username" ? theme.panelAlt : undefined }}>
        <input
          focused={props.field === "username"}
          value={props.username}
          placeholder="username / email (optional)"
          onInput={props.onUsername}
          onSubmit={props.onSubmit}
          style={{ flexGrow: 1, focusedBackgroundColor: theme.panelAlt }}
        />
      </box>

      {/* url */}
      <Label text="url" active={props.field === "url"} />
      <box style={{ height: 1, paddingLeft: 1, backgroundColor: props.field === "url" ? theme.panelAlt : undefined }}>
        <input
          focused={props.field === "url"}
          value={props.url}
          placeholder="https://… (optional)"
          onInput={props.onUrl}
          onSubmit={props.onSubmit}
          style={{ flexGrow: 1, focusedBackgroundColor: theme.panelAlt }}
        />
      </box>

      {/* notes */}
      <Label text="notes" active={props.field === "notes"} />
      <box
        style={{
          height: 5,
          backgroundColor: theme.panelAlt,
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <textarea
          ref={props.notesRef}
          focused={props.field === "notes"}
          initialValue={props.initialNotes}
          style={{ height: "100%", focusedBackgroundColor: theme.panelAlt }}
        />
      </box>

      <box style={{ marginTop: 1 }}>
        <Hint
          items={[
            ["tab", "next"],
            ["ctrl+g", "generate"],
            ["ctrl+r", reveal ? "hide" : "reveal"],
            ["ctrl+s", "save"],
            ["esc", "cancel"],
          ]}
        />
      </box>
    </Modal>
  );
}

function Label({ text, active }: { text: string; active: boolean }) {
  return <text style={{ fg: active ? theme.accent : theme.textDim, marginTop: 1 }}>{text}</text>;
}

/** A masked, read-display secret field with a block cursor when focused. */
function SecretField({ value, active, placeholder }: { value: string; active: boolean; placeholder: string }): ReactNode {
  const showPlaceholder = value === "" && !active;
  return (
    <box style={{ height: 1, paddingLeft: 1, backgroundColor: active ? theme.panelAlt : undefined }}>
      <text style={{ fg: showPlaceholder ? theme.textDim : theme.text }}>
        {showPlaceholder ? placeholder : value + (active ? "▏" : "")}
      </text>
    </box>
  );
}
