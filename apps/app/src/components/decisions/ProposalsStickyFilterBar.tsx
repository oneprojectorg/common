'use client';

import {
  MyProposalsHeader,
  type ProposalControls,
  type ProposalSelectControl,
  ProposalsFilterBar,
  type ProposalViewControls,
  ProposalsViewSwitch,
} from './ProposalsFilterBar';
import { StickyFilterBar } from './StickyFilterBar';

export interface ProposalsStickyFilterBarProps {
  /** Server count for the active filter. */
  count: number;
  /** Unfiltered count for the phase — the "of N" pool. */
  total: number;
  /** A narrower search field — see `ProposalsFilterBar`. */
  compactSearch?: boolean;
  /**
   * Absent when the phase hides proposals from non-admins: a plain label
   * replaces the count and no filters render.
   */
  controls?: ProposalControls;
  /** Absent when there is only one view to be in. */
  view?: ProposalViewControls;
  /** Admin-only CSV export control; omitted entirely for non-admins. */
  exportControl?: React.ReactNode;
  leadingSelect: ProposalSelectControl;
  /**
   * Px offset where the bar pins inside its scroll container — clears whatever
   * sticky chrome sits above it (e.g. the floating Overview/Current toggle).
   * Defaults to 0; the decision-view layout passes the toggle clearance.
   */
  pinOffset?: number;
}

/**
 * Proposal browse/grid filter bar inside the shared pinning shell. The count
 * belongs to the filter bar — it pairs with search on one row — so the bar owns
 * it, and only the filter-less fallback renders a header of its own.
 */
export const ProposalsStickyFilterBar = ({
  count,
  total,
  compactSearch,
  controls,
  view,
  exportControl,
  leadingSelect,
  pinOffset = 0,
}: ProposalsStickyFilterBarProps) => (
  <StickyFilterBar pinOffset={pinOffset}>
    {controls ? (
      <ProposalsFilterBar
        controls={controls}
        view={view}
        count={count}
        total={total}
        compactSearch={compactSearch}
        exportControl={exportControl}
        leadingSelect={leadingSelect}
      />
    ) : (
      <>
        <MyProposalsHeader />
        {/* No filters here, but still a view to be in — and on a process with
            no map this is the only control that leaves it. */}
        {view && <ProposalsViewSwitch view={view} />}
      </>
    )}
  </StickyFilterBar>
);
