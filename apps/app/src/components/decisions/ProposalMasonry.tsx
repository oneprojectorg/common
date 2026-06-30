'use client';

import { screens } from '@op/styles/constants';
import type { ReactNode } from 'react';
import Masonry from 'react-masonry-css';

// react-masonry-css keys are max-widths, so subtract 1 to mirror Tailwind's
// grid-cols-1 md:grid-cols-2 lg:grid-cols-3.
const md = parseInt(screens.md, 10);
const lg = parseInt(screens.lg, 10);
const BREAKPOINT_COLS = { default: 3, [lg - 1]: 2, [md - 1]: 1 };

export function ProposalMasonry({ children }: { children: ReactNode }) {
  return (
    // -ml-6/pl-6 are the column gutter.
    <Masonry
      breakpointCols={BREAKPOINT_COLS}
      className="-ml-6 flex w-auto"
      columnClassName="flex min-w-0 flex-col gap-6 pl-6"
    >
      {children}
    </Masonry>
  );
}
