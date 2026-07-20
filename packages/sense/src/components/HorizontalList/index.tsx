import * as React from 'react';

import { cn } from '../../lib/utils';

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
