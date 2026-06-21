// A row of "key → description" hints with the keys visually distinct (accent +
// bold) from their dim descriptions. Used in modal footers and pickers so the
// actionable keys always stand out from the surrounding prose.

import { TextAttributes } from "@opentui/core";
import { theme } from "./theme";

export function Hint({ items }: { items: [key: string, desc: string][] }) {
  return (
    <text>
      {items.map(([k, d], i) => (
        <span key={i}>
          <span style={{ fg: theme.accent, attributes: TextAttributes.BOLD }}>{k}</span>
          <span style={{ fg: theme.textDim }}>{` ${d}`}</span>
          {i < items.length - 1 ? <span style={{ fg: theme.textDim }}>{"   "}</span> : null}
        </span>
      ))}
    </text>
  );
}
