import type { ReactNode } from "react";

/**
 * Kiosk chrome.
 *
 * `kiosk-shell` hides the cursor and blocks selection, scrolling and the
 * long-press context menu. A wall-mounted screen has no keyboard and no
 * legitimate interaction, so anything a passer-by can trigger — a stuck text
 * selection, a scrolled-away header — is a defect that only staff can clear.
 *
 * The pairing screen sits outside this layout (`/lobby/pair`) because it does
 * need input.
 */
export default function LobbyLayout({ children }: { children: ReactNode }) {
  return <div className="kiosk-shell">{children}</div>;
}
