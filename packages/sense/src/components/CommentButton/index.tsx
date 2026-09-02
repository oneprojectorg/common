'use client';

import * as React from 'react';
import { LuMessageCircle } from 'react-icons/lu';

import {
  footerButtonClasses,
  footerButtonInteractiveClasses,
} from '../../lib/footerButton';
import { cn } from '../../lib/utils';

interface CommentButtonProps extends Omit<
  React.ComponentProps<'button'>,
  'children'
> {
  count?: number;
  /**
   * Translated accessible name (e.g. "3 comments"). Only the count is drawn, so
   * this is what a screen reader announces; it should contain the count so the
   * name still matches the visible text. Consumers pass an i18n-translated
   * string since this package is locale-agnostic.
   */
  label?: string;
}

/**
 * The comment half of a post's footer — a bubble and a count, sized to sit
 * beside `LikeButton`.
 */
function CommentButton({
  count = 0,
  label,
  className,
  dir = 'auto',
  disabled,
  ...props
}: CommentButtonProps) {
  return (
    <button
      type="button"
      data-slot="comment-button"
      dir={dir}
      aria-label={label ?? `${count} comments`}
      disabled={disabled}
      className={cn(
        footerButtonClasses,
        !disabled && footerButtonInteractiveClasses,
        className,
      )}
      {...props}
    >
      <LuMessageCircle className="size-5 shrink-0" />
      {/* The count changes without a navigation when a comment is posted. */}
      <span aria-live="polite">{count}</span>
    </button>
  );
}

export { CommentButton };
