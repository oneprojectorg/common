'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import Masonry from 'react-masonry-css';

// Auto-fit columns from the container width instead of fixed breakpoints:
// keep each card between MIN and MAX width, targeting the midpoint. react-
// masonry-css needs a concrete column count, so we measure with a
// ResizeObserver and recompute. Preserves masonry packing + item order.
const MIN_CARD_WIDTH = 300;
const MAX_CARD_WIDTH = 460;
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

export function ProposalMasonry({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(3);

  useEffect(() => {
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
      </Masonry>
    </div>
  );
}
