'use client';

import { trpc } from '@op/api/client';
import { type DecisionAccess } from '@op/api/encoders';
import { type Proposal } from '@op/common/client';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ProposalReviewsCount,
  getCompletedReviewers,
} from './ProposalReviewsCount';

/**
 * The card's status-row decoration. Only the count: these cards are proposals,
 * not assignments, and a status badge on one reads as the viewer's own
 * assignment status (it is the same badge the review queue uses for exactly
 * that), so no surface gets one from here.
 */
export interface ProposalReviewDecoration {
  reviewedLabel?: ReactNode;
}

const EMPTY_DECORATION: ProposalReviewDecoration = {};

/**
 * Whether a surface may show a zero count.
 *
 *   - `count` (default): "{count} Reviewed" from zero up — the admin surfaces,
 *     where "0 Reviewed" is precisely the thing being tracked.
 *   - `countWhenReviewed`: no decoration at all until a review is in — the
 *     reviewer flavor, where a zero is not the viewer's business.
 */
export type ProposalReviewPresentation = 'count' | 'countWhenReviewed';

interface ProposalReviewDecorationContextValue {
  getDecoration: (proposalId: string) => ProposalReviewDecoration;
  /** The rendered list reports what it has loaded; the fetch follows that set. */
  reportProposals: (proposals: Proposal[]) => void;
}

const ProposalReviewDecorationContext =
  createContext<ProposalReviewDecorationContextValue | null>(null);

interface ProposalReviewDecorationProviderProps {
  processInstanceId: string;
  /**
   * Decision profile slug — builds the per-proposal reviews link. Required: the
   * count is a link, and a missing slug would point it at
   * `/decisions/undefined/...`. Every review surface has the slug already.
   */
  decisionSlug: string;
  /**
   * Whether this viewer may see the counts. The GATE IS THE SURFACE'S:
   * the admin list passes its admin check, and a reviewer surface passes an
   * `openReviews`-derived one. Nothing below this prop knows which it was.
   */
  enabled: boolean;
  /**
   * Whether a zero count shows — see {@link ProposalReviewPresentation}. Not a
   * gate either; `enabled` already said whether to decorate at all.
   */
  presentation?: ProposalReviewPresentation;
  /**
   * Decides whether the count is a link to the Review Progress screen or plain
   * text — not a gate; `enabled` already said whether to decorate at all.
   */
  access?: DecisionAccess | null;
  children: ReactNode;
}

/**
 * Provides each proposal card inside it with its completed-review count —
 * "{count} Reviewed", linking an admin to the proposal's Review Progress screen.
 *
 * The surface owns this: it decides who may see the counts (`enabled`), whether
 * a zero shows (`presentation`), and wraps whatever list it renders, so no
 * review-domain prop has to thread through the proposal-agnostic list, grid and
 * card components. The list reports its loaded proposals (see
 * `useReportProposalsForReviewDecoration`) and the aggregates are fetched in
 * filtered mode for exactly those ids — pagination, filtering, sorting and map
 * mode stay entirely with `proposal.list`, and no proposal is fetched twice.
 */
export function ProposalReviewDecorationProvider({
  processInstanceId,
  decisionSlug,
  enabled,
  presentation = 'count',
  access,
  children,
}: ProposalReviewDecorationProviderProps) {
  const [proposalIds, setProposalIds] = useState<string[]>([]);

  const reportProposals = useCallback((proposals: Proposal[]) => {
    const next = proposals.map((proposal) => proposal.id);

    // Same ids, same state object: the reporting effect runs on every list
    // render, and a fresh array each time would refetch forever.
    setProposalIds((previous) =>
      previous.length === next.length &&
      previous.every((id, index) => id === next[index])
        ? previous
        : next,
    );
  }, []);

  const { data } = trpc.decision.listWithReviewAggregates.useQuery(
    {
      processInstanceId,
      proposalIds,
    },
    {
      enabled: enabled && proposalIds.length > 0,
    },
  );

  // Keyed by proposal id, holding the aggregates plus the profile id the
  // reviews link needs — both come from the same response row, so the card
  // only has to hand over an id.
  const itemsByProposalId = useMemo(
    () => new Map((data?.items ?? []).map((item) => [item.proposal.id, item])),
    [data],
  );

  const getDecoration = useCallback(
    (proposalId: string): ProposalReviewDecoration => {
      const item = itemsByProposalId.get(proposalId);

      // No decoration until the aggregates land — the card then renders exactly
      // as it does everywhere else, rather than flashing a "0 Reviewed" that
      // only means "not loaded yet".
      if (!enabled || !item) {
        return EMPTY_DECORATION;
      }

      // A surface that hides the zero decorates not at all rather than rendering
      // an empty count: an element that renders null is still truthy to the
      // card, which would draw a separator and an empty status row on every
      // unreviewed proposal. The test is the count's own definition, so the two
      // can't disagree about whether there is anything to report.
      if (
        presentation === 'countWhenReviewed' &&
        getCompletedReviewers(item.aggregates.reviewers).length === 0
      ) {
        return EMPTY_DECORATION;
      }

      return {
        reviewedLabel: (
          <ProposalReviewsCount
            reviewers={item.aggregates.reviewers}
            href={`/decisions/${decisionSlug}/proposal/${item.proposal.profileId}/reviews`}
            access={access ?? undefined}
            variant="reviewed"
          />
        ),
      };
    },
    [enabled, itemsByProposalId, decisionSlug, presentation, access],
  );

  const value = useMemo(
    () => ({ getDecoration, reportProposals }),
    [getDecoration, reportProposals],
  );

  return (
    <ProposalReviewDecorationContext.Provider value={value}>
      {children}
    </ProposalReviewDecorationContext.Provider>
  );
}

/**
 * One proposal's count decoration. Empty outside a provider, which is what keeps
 * the card view usable on every other proposal surface unchanged.
 */
export function useProposalReviewDecoration(
  proposalId: string,
): ProposalReviewDecoration {
  const context = useContext(ProposalReviewDecorationContext);

  return context?.getDecoration(proposalId) ?? EMPTY_DECORATION;
}

/**
 * Reports a list's loaded proposals to an enclosing decoration provider, which
 * fetches the aggregates for them. A no-op without a provider, so a list can
 * call it unconditionally.
 */
export function useReportProposalsForReviewDecoration(proposals: Proposal[]) {
  const report = useContext(ProposalReviewDecorationContext)?.reportProposals;

  useEffect(() => {
    report?.(proposals);
  }, [report, proposals]);
}
