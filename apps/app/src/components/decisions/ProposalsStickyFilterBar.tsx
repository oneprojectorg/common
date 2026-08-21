'use client';

import {
  MyProposalsHeader,
  type ProposalControls,
  ProposalsFilterBar,
  type ProposalViewControls,
} from './ProposalsFilterBar';
import { StickyFilterBar } from './StickyFilterBar';

export interface ProposalsStickyFilterBarProps {
  /** Server count for the active filter. */
  count: number;
  /** Unfiltered count for the phase — the "of N" pool. */
  total: number;
  /** Replaces the proposal count on the left — e.g. the admin review title. */
  header?: React.ReactNode;
  /**
   * Absent when the phase hides proposals from non-admins: the header falls back
   * to a plain label and no filters render.
   */
  controls?: ProposalControls;
  /** Absent when the process collects no location. */
  view?: ProposalViewControls;
  /** Admin-only CSV export control; omitted entirely for non-admins. */
  exportControl?: React.ReactNode;
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
  header,
  controls,
  view,
  exportControl,
  pinOffset = 0,
}: ProposalsStickyFilterBarProps) => (
  <StickyFilterBar pinOffset={pinOffset}>
    {controls ? (
      <ProposalsFilterBar
        controls={controls}
        view={view}
        count={count}
        total={total}
        header={header}
        exportControl={exportControl}
      />
    ) : (
      (header ?? <MyProposalsHeader />)
    )}
  </StickyFilterBar>
);
