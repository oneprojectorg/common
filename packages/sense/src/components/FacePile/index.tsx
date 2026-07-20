'use client';

import * as React from 'react';

import { cn } from '../../lib/utils';
import { Avatar, AvatarFallback } from '../ui/avatar';

interface FacePileProps extends React.ComponentProps<'div'> {
  /** Avatar nodes to stack with a slight overlap, first item on top. */
  items: Array<React.ReactNode>;
  /** Class applied to the stacked list (e.g. to adjust overlap). */
  listClassName?: string;
}

function FacePile({
  items,
  children,
  className,
  listClassName,
  ...props
}: FacePileProps) {
  return (
    <div
      data-slot="face-pile"
      className={cn(
        'flex w-full max-w-fit flex-wrap items-center justify-center gap-2',
        className,
      )}
      {...props}
    >
      <ul className={cn('flex', listClassName)}>
        {items.map((node, index) => (
          <li key={index} className="relative -ms-2 first:ms-0">
            {node}
          </li>
        ))}
      </ul>
      {children}
    </div>
  );
}

interface GrowingFacePileProps {
  children?: React.ReactNode;
  items: Array<React.ReactNode>;
  maxItems?: number;
  /**
   * When set, the "+N" bubble counts everyone beyond the rendered faces
   * (totalCount - rendered), so a few avatars can still convey a large total.
   */
  totalCount?: number;
}

function GrowingFacePile({
  children,
  items,
  maxItems = 20,
  totalCount,
}: GrowingFacePileProps) {
  const facePileRef = React.useRef<HTMLDivElement>(null);
  const [numItems, setNumItems] = React.useState(maxItems);

  React.useEffect(() => {
    if (!facePileRef.current) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      // Each face occupies its 32px width minus the 8px stack overlap.
      setNumItems(
        Math.min(
          Math.floor((entries[0]?.contentRect.width ?? 1) / (32 - 8)),
          maxItems,
        ),
      );
    });

    resizeObserver.observe(facePileRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [maxItems]);

  const renderedItems = items.slice(0, numItems);

  const overflowCount =
    totalCount !== undefined
      ? totalCount - renderedItems.length
      : items.length - numItems;

  if (overflowCount > 0) {
    renderedItems.push(
      <Avatar>
        <AvatarFallback className="bg-foreground text-sm text-background">
          +{overflowCount}
        </AvatarFallback>
      </Avatar>,
    );
  }

  return (
    <FacePile ref={facePileRef} items={renderedItems}>
      {children}
    </FacePile>
  );
}

export { FacePile, GrowingFacePile };
