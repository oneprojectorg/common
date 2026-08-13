import * as React from 'react';

import { cn } from '../../lib/utils';

/**
 * A horizontally scrolling row of items that snaps to each one, with the
 * scrollbar hidden.
 *
 * A real `<ul>`/`<li>`, so it keeps list semantics and the count a screen
 * reader announces. The container is focusable by keyboard because it scrolls —
 * don't remove its tab stop to tidy the focus order.
 */
function HorizontalList({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="horizontal-list"
      className={cn(
        'relative no-scrollbar flex max-w-full snap-x snap-mandatory gap-x-2 overflow-x-auto',
        className,
      )}
      {...props}
    />
  );
}

/** A single snap target inside a {@link HorizontalList}. */
function HorizontalListItem({
  className,
  ...props
}: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="horizontal-list-item"
      className={cn('relative shrink-0 snap-start', className)}
      {...props}
    />
  );
}

export { HorizontalList, HorizontalListItem };
