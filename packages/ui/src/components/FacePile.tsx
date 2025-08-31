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
      <div className="flex w-full flex-wrap items-center gap-2" ref={ref}>
        <ul className={cn('-gap-2 flex', className)}>
          {items.map((node, i) => (
            <li key={i} className="relative -ml-2">
              {node}
            </li>
          ))}
        </ul>
        {children}
      </div>
    );
  },
);
