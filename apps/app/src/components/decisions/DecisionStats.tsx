'use client';

import { ReactNode, useEffect, useState } from 'react';

/**
 * Row of hero-banner stats. Text takes the colour of the banner. The padding
 * adds to the banner's `gap-4`, for the 32px the design puts above and below.
 * Stats wrap only when one row would overflow. Each stat draws the divider
 * before it, hidden when the stat starts a line.
 */
export function DecisionStats({ children }: { children: ReactNode }) {
  const [row, setRow] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!row) {
      return;
    }

    // Toggling the attribute changes no layout, so the observer cannot loop.
    const markLineStarts = () => {
      let previousTop: number | undefined;
      for (const stat of Array.from(row.children)) {
        if (!(stat instanceof HTMLElement)) {
          continue;
        }
        stat.toggleAttribute('data-line-start', stat.offsetTop !== previousTop);
        previousTop = stat.offsetTop;
      }
    };

    markLineStarts();
    const observer = new ResizeObserver(markLineStarts);
    observer.observe(row);
    return () => observer.disconnect();
  }, [row, children]);

  return (
    <div
      ref={setRow}
      className="flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-4 py-4 sm:gap-x-8"
    >
      {children}
    </div>
  );
}

export function DecisionStat({
  value,
  label,
}: {
  value: ReactNode;
  label: ReactNode;
}) {
  return (
    <div className="relative flex min-w-24 flex-col items-center gap-2 before:absolute before:-start-2 before:top-1/2 before:h-5 before:w-px before:-translate-y-1/2 before:bg-current/50 data-line-start:before:hidden sm:min-w-40 sm:before:-start-4">
      <div className="flex items-center justify-center font-serif text-headline font-light">
        {value}
      </div>
      <div className="flex items-center justify-center text-center text-sm">
        {label}
      </div>
    </div>
  );
}
