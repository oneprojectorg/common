/**
 * Chrome shared by the buttons in a post's footer, so `LikeButton` and
 * `CommentButton` stay identical sitting next to each other. Internal to the
 * package — neither composite re-exports it.
 *
 * The footer reads as icons with a count, not as filled controls: no background,
 * no border. The `p-2` is the design's `spacing/2` — it sets the button's
 * bounding box, which is what separates the icons from the text above and from
 * each other, so the two buttons sit flush and let their padding do the spacing.
 * The rounding only gives the focus ring a shape.
 */
export const footerButtonClasses =
  'flex items-center gap-1.5 rounded-sm p-2 text-sm text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50';

export const footerButtonInteractiveClasses =
  'cursor-pointer hover:text-foreground';
