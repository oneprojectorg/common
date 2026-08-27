/**
 * Chrome shared by the buttons in a post's footer, so `LikeButton` and
 * `CommentButton` stay pixel-identical sitting next to each other. Internal to
 * the package — neither composite re-exports it.
 */
export const footerButtonClasses =
  'flex h-8 items-center justify-center gap-1 rounded-md bg-muted px-2 py-1 text-sm text-nowrap text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50';

export const footerButtonInteractiveClasses =
  'cursor-pointer hover:bg-gray-100 hover:text-foreground active:bg-gray-200 active:text-foreground';
