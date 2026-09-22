/** The parts of a mouse event that decide whether the browser would navigate. */
export type ClickIntent = {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
};

/**
 * Whether a click on a link is the plain left click a handler may cancel.
 *
 * Anything else is the reader asking the browser for something we can't give
 * them in-page — a new tab (cmd/ctrl or middle click), a new window (shift), a
 * download (alt) — so the click has to fall through to the `href`. Cancelling
 * those is how an in-page panel quietly breaks "open in new tab".
 *
 * Also declines a click something upstream already handled
 * (`defaultPrevented`), so two handlers on the same link can't both claim it.
 */
export const isPlainLeftClick = ({
  button,
  metaKey,
  ctrlKey,
  shiftKey,
  altKey,
  defaultPrevented,
}: ClickIntent): boolean =>
  !defaultPrevented &&
  button === 0 &&
  !metaKey &&
  !ctrlKey &&
  !shiftKey &&
  !altKey;
