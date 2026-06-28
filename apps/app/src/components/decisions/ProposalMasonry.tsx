'use client';

import { screens } from '@op/styles/constants';
import type { ReactNode } from 'react';
import Masonry from 'react-masonry-css';

// react-masonry-css keys are max-widths (applies when window width ≤ key), so
// subtract 1 from the min-width breakpoints to mirror Tailwind's
// `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`: ≥lg → 3, md–lg → 2, <md → 1.
const md = parseInt(screens.md, 10);
const lg = parseInt(screens.lg, 10);
const BREAKPOINT_COLS = { default: 3, [lg - 1]: 2, [md - 1]: 1 };

/**
 * Row-order masonry layout for proposal/review cards. Preserves the server's
 * sort order left-to-right while packing variable-height cards into columns.
 * ponytail: react-masonry-css balances by item count, not measured height, so
 * column bottoms are ragged. Swap for `masonic` only if true packing matters.
 */
export function ProposalMasonry({ children }: { children: ReactNode }) {
  return (
    <Masonry
      breakpointCols={BREAKPOINT_COLS}
      className="flex gap-6"
      columnClassName="flex min-w-0 flex-1 flex-col gap-6"
    >
      {children}
    </Masonry>
  );
}
