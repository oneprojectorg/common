/**
 * Chrome shared by the buttons in a post's footer, so `LikeButton` and
 * `CommentButton` stay identical sitting next to each other. Internal to the
 * package — neither composite re-exports it.
 *
 * The footer reads as icons with a count, not as controls: no fill, no border,
 * no padding. The rounding exists only so the focus ring has a shape.
 */
export const footerButtonClasses =
  'flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50';

export const footerButtonInteractiveClasses =
  'cursor-pointer hover:text-foreground';
