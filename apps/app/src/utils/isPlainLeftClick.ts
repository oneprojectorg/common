export type ClickIntent = {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
};

/**
 * Whether a click on a link may be cancelled. Anything else is the reader
 * asking for a new tab, window or download, which has to reach the `href`.
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
