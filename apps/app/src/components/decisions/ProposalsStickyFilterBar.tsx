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
  proposalFilter: ProposalFilter;
  setProposalFilter: (filter: ProposalFilter) => void;
  hasVoted: boolean;
  currentProfileId: string | undefined;
  categories: { id: string; name: string }[];
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  sortOrder: string;
  setSortOrder: (value: string) => void;
  canManageProposals: boolean;
  isExporting: boolean;
  isDownloadReady: boolean;
  downloadUrl?: string | null;
  downloadFileName?: string | null;
  onExport: () => void;
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
  proposalFilter,
  setProposalFilter,
  hasVoted,
  currentProfileId,
  categories,
  selectedCategory,
  setSelectedCategory,
  sortOrder,
  setSortOrder,
  canManageProposals,
  isExporting,
  isDownloadReady,
  downloadUrl,
  downloadFileName,
  onExport,
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
          'group sticky z-20 flex flex-wrap items-center justify-between gap-4 overflow-visible bg-white py-3 transition-shadow',
          "before:pointer-events-none before:absolute before:top-0 before:left-1/2 before:w-screen before:-translate-x-1/2 before:border-t before:border-neutral-gray1 before:opacity-0 before:content-['']",
          "after:pointer-events-none after:absolute after:-bottom-px after:left-1/2 after:w-screen after:-translate-x-1/2 after:border-b after:border-neutral-gray1 after:opacity-0 after:content-['']",
          'data-[pinned=true]:before:opacity-100 data-[pinned=true]:after:opacity-100',
        )}
      >
        {/* White band filling the gap above the bar (behind the floating mobile
            toggle) once pinned — its height/offset track `pinOffset` so content
            stops showing behind the toggle when the bar locks. While scrolling,
            it's transparent so the phase header shows through. */}
        <div
          aria-hidden
          style={{ top: -pinOffset, height: pinOffset }}
          className="pointer-events-none absolute left-1/2 hidden w-screen -translate-x-1/2 bg-white opacity-0 transition-opacity group-data-[pinned=true]:opacity-100 max-md:block"
        />
        <ProposalsListHeader
          hideFilters={hideFilters}
          proposalFilter={proposalFilter}
          // Server-side filtering makes `total` accurate for the active filter.
          count={total}
        />
        {!hideFilters && (
          <div className="flex items-center gap-4">
            <ProposalsFilterBar
              hasVoted={hasVoted}
              currentProfileId={currentProfileId}
              proposalFilter={proposalFilter}
              setProposalFilter={setProposalFilter}
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              sortOrder={sortOrder}
              onSelectSort={setSortOrder}
              canManageProposals={canManageProposals}
              isExporting={isExporting}
              isDownloadReady={isDownloadReady}
              downloadUrl={downloadUrl}
              downloadFileName={downloadFileName}
              onExport={onExport}
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
