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
  dir = 'auto',
  ...props
}: CommentButtonProps) {
  return (
    <button
      type="button"
      data-slot="comment-button"
      dir={dir}
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

export { CommentButton };
