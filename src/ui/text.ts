// Small text helpers shared by the UI chrome.

/** Uppercase the first character (used for container headers). */
export function capitalize(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}
