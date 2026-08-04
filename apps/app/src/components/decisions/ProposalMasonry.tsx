'use client';

import type { ReactNode } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Masonry from 'react-masonry-css';

import { ProposalCardSkeleton } from './ProposalCardSkeleton';

// Measure the column count before the browser paints so the grid never flashes
// the default 3 columns then reflows. `useLayoutEffect` warns during SSR (it's
// a no-op there), so fall back to `useEffect` on the server.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// Auto-fit columns from the container width instead of fixed breakpoints:
// keep each card between MIN and MAX width, targeting the midpoint. react-
// masonry-css needs a concrete column count, so we measure with a
// ResizeObserver and recompute. Preserves masonry packing + item order.
const MIN_CARD_WIDTH = 340;
const MAX_CARD_WIDTH = 420;
const TARGET_CARD_WIDTH = (MIN_CARD_WIDTH + MAX_CARD_WIDTH) / 2;

const columnsForWidth = (width: number): number => {
  if (width <= 0) {
    return 1;
  }
  // Bounds so each card stays within [MIN, MAX] width...
  const mostColumns = Math.max(1, Math.floor(width / MIN_CARD_WIDTH));
  const fewestColumns = Math.max(1, Math.ceil(width / MAX_CARD_WIDTH));
  // ...then target the midpoint width and clamp into that range.
  const target = Math.round(width / TARGET_CARD_WIDTH);
  return Math.min(mostColumns, Math.max(fewestColumns, target));
};

export function ProposalMasonry({
  children,
  /**
   * Append one loading skeleton to the bottom of each column while the next
   * page fetches. Masonry distributes children round-robin, so exactly
   * `columns` skeletons land one-per-column — filling the ragged bottom of the
   * variable-width grid instead of a separate fixed-column block below it.
   */
  loadingMore = false,
}: {
  children: ReactNode;
  loadingMore?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(3);

  useIsomorphicLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    setColumns(columnsForWidth(el.clientWidth));
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) {
        setColumns(columnsForWidth(width));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef}>
      {/* -ms-6/ps-6 are the column gutter (logical, so it flips in RTL). */}
      <Masonry
        breakpointCols={columns}
        className="-ms-6 flex w-auto"
        columnClassName="flex min-w-0 flex-col gap-6 ps-6"
      >
        {children}
        {loadingMore
          ? Array.from({ length: columns }).map((_, index) => (
              <ProposalCardSkeleton key={`loading-more-${index}`} />
            ))
          : null}
      </Masonry>
    </div>
  );
}
