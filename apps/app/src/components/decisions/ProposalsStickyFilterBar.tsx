'use client';

import type { ProposalFilter } from '@op/api/encoders';

import { type ProposalView, ProposalViewToggle } from './ProposalViewToggle';
import { ProposalsFilterBar, ProposalsListHeader } from './ProposalsFilterBar';
import { StickyFilterBar } from './StickyFilterBar';

export interface ProposalsStickyFilterBarProps {
  hideFilters: boolean;
  /** Replaces the proposal count on the left — e.g. the admin review title. */
  header?: React.ReactNode;
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
  /** Admin-only CSV export control; omitted entirely for non-admins. */
  exportControl?: React.ReactNode;
  /**
   * Px offset where the bar pins inside its scroll container — clears whatever
   * sticky chrome sits above it (e.g. the floating Overview/Current toggle).
   * Drives both the sticky `top` and the observer rootMargin. Defaults to 0;
   * the decision-view layout passes the toggle clearance.
   */
  pinOffset?: number;
}

// Proposal browse/grid filter bar — pins at `pinOffset` inside the scrolling
// content area via the shared `StickyFilterBar` shell. The bar pins just below
// the floating Overview/Current toggle; content above it (the phase header)
// scrolls up behind the toggle.
export const ProposalsStickyFilterBar = ({
  hideFilters,
  header,
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
  exportControl,
  pinOffset = 0,
}: ProposalsStickyFilterBarProps) => {
  return (
    <StickyFilterBar pinOffset={pinOffset}>
      {header ?? (
        <ProposalsListHeader
          hideFilters={hideFilters}
          // `total` is the server count for the active filter; totalProposalCount
          // is the unfiltered pool ("6 of 328 proposals").
          count={total}
          total={totalProposalCount}
        />
      )}
      {!hideFilters && (
        <div className="scrollbar-none flex items-center gap-4 max-md:-mx-4 max-md:w-screen max-md:overflow-x-scroll max-md:px-4">
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
              <span aria-hidden className="h-6 w-px bg-border" />
              <ProposalViewToggle
                value={effectiveView}
                onChange={onViewChange}
              />
            </div>
          )}
          {exportControl && (
            <div className="flex items-center gap-4">
              <span aria-hidden className="h-6 w-px bg-border" />
              {exportControl}
            </div>
          )}
        </div>
      )}
    </StickyFilterBar>
  );
};
