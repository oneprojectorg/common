'use client';

import { trpc } from '@op/api/client';
import {
  type Proposal,
  type ProposalReviewAggregates,
} from '@op/common/client';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { ProposalReviewsCount } from './ProposalReviewsCount';

/**
 * The card's status-row decoration. Only the count — a status badge here would
 * read as the viewer's own assignment status.
 */
export interface ProposalReviewDecoration {
  reviewedLabel?: ReactNode;
}

const EMPTY_DECORATION: ProposalReviewDecoration = {};

interface ProposalReviewDecorationContextValue {
  getDecoration: (proposalId: string) => ProposalReviewDecoration;
  /** Undefined until the aggregates land, or when the viewer may not see them. */
  getAggregates: (proposalId: string) => ProposalReviewAggregates | undefined;
  /** The rendered list reports what it has loaded; the fetch follows that set. */
  reportProposals: (proposals: Proposal[]) => void;
}

const ProposalReviewDecorationContext =
  createContext<ProposalReviewDecorationContextValue | null>(null);

interface ProposalReviewDecorationProviderProps {
  processInstanceId: string;
  /** Decision profile slug — builds the per-proposal reviews link. */
  decisionSlug: string;
  /**
   * Phase whose reviews are counted; defaults to the instance's current phase.
   * The endpoint requires it for non-admin callers.
   */
  phaseId?: string;
  /** Whether this viewer may see the counts — each surface passes its own gate. */
  enabled: boolean;
  /** Whether the count links to the proposal's reviews screen. */
  canOpenReviews: boolean;
  children: ReactNode;
}

/**
 * Provides each proposal card inside it with its completed-review count. The
 * wrapping surface decides who may see the counts; the
 * list reports its loaded proposals (see
 * `useReportProposalsForReviewDecoration`) and the aggregates are fetched for
 * exactly those ids, so no review-domain prop threads through the
 * proposal-agnostic list, grid and card components.
 */
export function ProposalReviewDecorationProvider({
  processInstanceId,
  decisionSlug,
  phaseId,
  enabled,
  canOpenReviews,
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
      phaseId,
      proposalIds,
    },
    {
      enabled: enabled && proposalIds.length > 0,
    },
  );

  const aggregates = data?.items;

  const itemsByProposalId = useMemo(
    () => new Map((aggregates ?? []).map((item) => [item.proposal.id, item])),
    [aggregates],
  );

  const getDecoration = useCallback(
    (proposalId: string): ProposalReviewDecoration => {
      const item = itemsByProposalId.get(proposalId);

      // No decoration until the aggregates land, rather than flashing a
      // "0 Reviewed" that only means "not loaded yet".
      if (!enabled || !item) {
        return EMPTY_DECORATION;
      }

      return {
        reviewedLabel: (
          <ProposalReviewsCount
            reviewers={item.aggregates.reviewers}
            href={`/decisions/${decisionSlug}/proposal/${item.proposal.profileId}/reviews`}
            canOpenReviews={canOpenReviews}
            variant="reviewed"
          />
        ),
      };
    },
    [enabled, itemsByProposalId, decisionSlug, canOpenReviews],
  );

  const getAggregates = useCallback(
    (proposalId: string) =>
      enabled ? itemsByProposalId.get(proposalId)?.aggregates : undefined,
    [enabled, itemsByProposalId],
  );

  const value = useMemo(
    () => ({ getDecoration, getAggregates, reportProposals }),
    [getDecoration, getAggregates, reportProposals],
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
 * One proposal's review aggregates, for surfaces that render more than the
 * card's count (the review progress table). Undefined outside a provider and
 * while the aggregates load.
 */
export function useProposalReviewAggregates(
  proposalId: string,
): ProposalReviewAggregates | undefined {
  const context = useContext(ProposalReviewDecorationContext);

  return context?.getAggregates(proposalId);
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
