import type { ReactNode } from 'react';

import { Bullet } from '../../Bullet';

export function ReviewListHeader({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <span className="font-serif text-title-base text-neutral-black">
          {title}
        </span>
        <Bullet />
        <span className="font-serif text-title-base text-neutral-black">
          {count}
        </span>
      </div>
      {children ? (
        <div className="grid max-w-fit grid-cols-2 justify-end gap-2 sm:flex sm:flex-1 sm:flex-wrap sm:items-center sm:justify-end">
          {children}
        </div>
      ) : null}
    </div>
  );
}
