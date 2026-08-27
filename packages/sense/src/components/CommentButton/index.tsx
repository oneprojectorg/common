'use client';

import * as React from 'react';
import { LuMessageCircle } from 'react-icons/lu';

import { cn } from '../../lib/utils';

/**
 * Chrome shared by the buttons in a post's footer, so `LikeButton` and
 * `CommentButton` stay pixel-identical sitting next to each other.
 */
const footerButtonClasses =
  'flex h-8 items-center justify-center gap-1 rounded-md bg-muted px-2 py-1 text-sm text-nowrap text-muted-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50';

const footerButtonInteractiveClasses =
  'cursor-pointer hover:bg-gray-100 hover:text-foreground active:bg-gray-200 active:text-foreground';

interface CommentButtonProps extends Omit<
  React.ComponentProps<'button'>,
  'children'
> {
  count?: number;
  /**
   * Fully-formatted, translated label (e.g. "3 comments"). Consumers should
   * pass an i18n-translated string since this package is locale-agnostic.
   * Falls back to an English default when omitted.
   */
  label?: string;
}

function CommentButton({
  count = 0,
  label,
  className,
  ...props
}: CommentButtonProps) {
  return (
    <button
      type="button"
      data-slot="comment-button"
      className={cn(
        footerButtonClasses,
        footerButtonInteractiveClasses,
        className,
      )}
      {...props}
    >
      <LuMessageCircle className="size-4 shrink-0" />
      <span>{label ?? `${count} comments`}</span>
    </button>
  );
}

export { CommentButton, footerButtonClasses, footerButtonInteractiveClasses };
