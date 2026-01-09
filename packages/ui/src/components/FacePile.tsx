import { ReactNode, forwardRef } from 'react';

import { cn } from '../lib/utils';

export const FacePile = forwardRef<
  HTMLDivElement,
  { items: Array<ReactNode>; children?: ReactNode; className?: string }
>(
  (
    {
      items,
      children,
      className,
    }: { className?: string; children?: ReactNode; items: Array<ReactNode> },
    ref,
  ) => {
    return (
      <div
        className="gap-2 flex w-full max-w-fit flex-wrap items-center"
        ref={ref}
      >
        <ul className={cn('-gap-2 flex', className)}>
          {items.map((node, i) => (
            <li key={i} className="-ml-2 relative">
              {node}
            </li>
          ))}
        </ul>
        {children}
      </div>
    );
  },
);
