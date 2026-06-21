// Parse a decrypted secret into password + fields + notes.
//
// `pass` convention: line 1 is the password; subsequent lines are free-form,
// commonly "key: value" metadata (login, url, otpauth://...). We surface those
// as structured fields while keeping anything unstructured as notes.

import type { Secret, SecretField } from "../types";

const FIELD_RE = /^([A-Za-z0-9 _-]{1,40}):\s*(.*)$/;

export function parseSecret(raw: string): Secret {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  // Drop a single trailing empty line that gpg/editors commonly add.
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();

  const password = lines[0] ?? "";
  const fields: SecretField[] = [];
  const notes: string[] = [];

  for (const line of lines.slice(1)) {
    const m = line.match(FIELD_RE);
    if (m && m[1] !== undefined) {
      fields.push({ key: m[1].trim(), value: m[2] ?? "" });
    } else if (line.trim() !== "") {
      notes.push(line);
    }
  }

  return { password, fields, notes, raw };
}

/** The structured fields the entry form edits. */
export interface EntryForm {
  password: string;
  username: string;
  url: string;
  notes: string;
}

const USER_KEYS = /^(login|username|user|email|e-mail)$/i;
const URL_KEYS = /^(url|website|site|link)$/i;

/** Parse a decrypted secret into the form's labeled fields. */
export function toForm(secret: Secret): EntryForm {
  let username = "";
  let url = "";
  const leftover: string[] = [];

  for (const f of secret.fields) {
    if (!username && USER_KEYS.test(f.key)) username = f.value;
    else if (!url && URL_KEYS.test(f.key)) url = f.value;
    else leftover.push(`${f.key}: ${f.value}`); // preserve custom metadata
  }

  const notes = [...leftover, ...secret.notes].join("\n");
  return { password: secret.password, username, url, notes };
}

/**
 * Serialize the form back to `pass`'s positional format:
 *   line 1        password
 *   login: ...    (if set)
 *   url: ...       (if set)
 *   <notes...>    (verbatim — may itself contain key: value lines)
 */
export function fromForm(form: EntryForm): string {
  const lines: string[] = [form.password];
  if (form.username.trim()) lines.push(`login: ${form.username.trim()}`);
  if (form.url.trim()) lines.push(`url: ${form.url.trim()}`);
  const notes = form.notes.replace(/\r\n/g, "\n").trimEnd();
  if (notes) lines.push(...notes.split("\n"));
  return lines.join("\n") + "\n";
}

/** True if the secret carries a TOTP/HOTP URI (pass-otp compatible). */
export function hasOtp(secret: Secret): boolean {
  return (
    secret.raw.includes("otpauth://") ||
    secret.fields.some((f) => f.value.includes("otpauth://"))
  );
}
