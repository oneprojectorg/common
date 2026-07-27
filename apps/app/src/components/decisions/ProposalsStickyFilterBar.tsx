'use client';

import type { ProposalFilter } from '@op/api/encoders';
import { cn } from '@op/ui/utils';
import { useEffect, useRef, useState } from 'react';

import { type ProposalView, ProposalViewToggle } from './ProposalViewToggle';
import { ProposalsFilterBar, ProposalsListHeader } from './ProposalsFilterBar';

export interface ProposalsStickyFilterBarProps {
  hideFilters: boolean;
  /** Full server-side proposal count for the active filter. */
  total: number;
  /** Unfiltered proposal count for the instance — the "of N" pool. */
  totalProposalCount: number;
  proposalFilter: ProposalFilter;
  setProposalFilter: (filter: ProposalFilter) => void;
  hasVoted: boolean;
  currentProfileId: string | undefined;
  decisionSlug: string | undefined;
  categories: { id: string; name: string }[];
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  sortOrder: string;
  setSortOrder: (value: string) => void;
  hasLocationField: boolean;
  effectiveView: ProposalView;
  onViewChange: (next: ProposalView) => void;
  /**
   * Px offset where the bar pins inside its scroll container — clears whatever
   * sticky chrome sits above it (e.g. the floating Overview/Current toggle).
   * Drives both the sticky `top` and the observer rootMargin. Defaults to 0;
   * the decision-view layout passes the toggle clearance.
   */
  pinOffset?: number;
}

// Nearest scrollable ancestor — the IntersectionObserver root, so pin detection
// is measured against the grid's content scroll container rather than the
// viewport.
const getScrollParent = (node: Element | null): Element | null => {
  let el = node?.parentElement ?? null;
  while (el) {
    const overflowY = getComputedStyle(el).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return el;
    }
    el = el.parentElement;
  }
  return null;
};

// Filters bar — pins at `pinOffset` inside the scrolling content area. A
// zero-height sentinel just above it, observed against the scroll container with
// rootMargin shrunk by the same offset, flips data-pinned exactly as the bar
// locks. Once pinned, the full-bleed hairlines fade in. The bar pins just below
// the floating Overview/Current toggle; content above it (the phase header)
// scrolls up behind the toggle.
export const ProposalsStickyFilterBar = ({
  hideFilters,
  total,
  totalProposalCount,
  proposalFilter,
  setProposalFilter,
  hasVoted,
  currentProfileId,
  decisionSlug,
  categories,
  selectedCategory,
  setSelectedCategory,
  sortOrder,
  setSortOrder,
  hasLocationField,
  effectiveView,
  onViewChange,
  pinOffset = 0,
}: ProposalsStickyFilterBarProps) => {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setIsPinned(!entry?.isIntersecting),
      {
        root: getScrollParent(sentinel),
        rootMargin: `-${pinOffset}px 0px 0px 0px`,
        threshold: 0,
      },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [pinOffset]);

  return (
    <>
      {/* Sentinel at the bar's natural top — absolute so it adds no space in the
          parent's flex `gap`. Anchors to the list's `relative` container; once it
          passes the pin line (scroll container top, shrunk by pinOffset) the
          observer flips. */}
      <div
        ref={sentinelRef}
        aria-hidden
        className="absolute top-0 left-0 h-px w-px"
      />
      <div
        data-pinned={isPinned || undefined}
        style={{ top: pinOffset }}
        className={cn(
          // `top` (inline) only matters on mobile, where it clears the floating
          // toggle; on >=md the toggle is inline in the header, so pin flush at 0.
          'group sticky z-20 flex flex-wrap items-center justify-between gap-4 overflow-visible bg-white py-3 transition-shadow md:top-0!',
          // Top hairline fades in on pin — mobile only (>=md has no floating
          // toggle above the bar, so no top edge to delineate).
          "max-md:before:pointer-events-none max-md:before:absolute max-md:before:top-0 max-md:before:left-1/2 max-md:before:w-screen max-md:before:-translate-x-1/2 max-md:before:border-t max-md:before:border-neutral-gray1 max-md:before:opacity-0 max-md:before:content-['']",
          'max-md:data-[pinned=true]:before:opacity-100',
          // Bottom hairline fades in on pin — all breakpoints.
          "after:pointer-events-none after:absolute after:-bottom-px after:left-1/2 after:w-screen after:-translate-x-1/2 after:border-b after:border-neutral-gray1 after:opacity-0 after:content-['']",
          'data-[pinned=true]:after:opacity-100',
          // Break the bar out to full viewport width on mobile so the filter row
          // can scroll edge-to-edge. Content keeps its gutter via px-4.
          'max-md:ml-[calc(50%_-_50vw)] max-md:w-screen max-md:px-4',
        )}
      >
        {/* Full-bleed white that fades in once pinned — covers the bar and its
            side gutters (the bar itself is content-width, so without this,
            proposals show through the gutters when pinned). On mobile it also
            extends up by `pinOffset` to back the floating toggle; on >=md the
            bar pins flush so it starts at the bar top. Sits behind the bar's own
            content (-z-10) but above the scrolling proposals (the bar's z-20). */}
        <div
          aria-hidden
          style={{ top: -pinOffset }}
          className="pointer-events-none absolute bottom-0 left-1/2 -z-10 w-screen -translate-x-1/2 bg-white opacity-0 transition-opacity group-data-[pinned=true]:opacity-100 md:top-0!"
        />
        <ProposalsListHeader
          hideFilters={hideFilters}
          // `total` is the server count for the active filter; totalProposalCount
          // is the unfiltered pool ("6 of 328 proposals").
          count={total}
          total={totalProposalCount}
        />
        {!hideFilters && (
          <div className="flex items-center gap-4 max-md:-mx-4 max-md:w-screen max-md:overflow-x-scroll max-md:px-4">
            <ProposalsFilterBar
              hasVoted={hasVoted}
              currentProfileId={currentProfileId}
              proposalFilter={proposalFilter}
              setProposalFilter={setProposalFilter}
              decisionSlug={decisionSlug}
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              sortOrder={sortOrder}
              onSelectSort={setSortOrder}
            />
            {hasLocationField && (
              <div className="hidden items-center gap-4 sm:flex">
                <span aria-hidden className="h-6 w-px bg-neutral-gray2" />
                <ProposalViewToggle
                  value={effectiveView}
                  onChange={onViewChange}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
