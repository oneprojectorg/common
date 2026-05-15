// Compat wrapper for @op/ui's FacePile. Composes vanilla shadcn AvatarGroup.

import { type ReactNode, forwardRef } from 'react';

import { AvatarGroup } from './ui/avatar';

export const FacePile = forwardRef<
  HTMLDivElement,
  { items: Array<ReactNode>; children?: ReactNode; className?: string }
>(function FacePile({ items, children, className }, ref) {
  return (
    <div ref={ref} className="flex w-full max-w-fit flex-wrap items-center gap-2">
      <AvatarGroup className={className}>
        {items.map((node, i) => (
          <span key={i} className="contents">
            {node}
          </span>
        ))}
      </AvatarGroup>
      {children}
    </div>
  );
});

export default FacePile;
