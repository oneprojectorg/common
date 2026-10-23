'use client';

import { chunk } from '@/utils/chunk';
import { trpc } from '@op/api/client';
import {
  type Proposal,
  type ProposalReviewAggregates,
} from '@op/common/client';
import { logger } from '@op/logging/client';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ProposalReviewsCount } from './ProposalReviewsCount';
import { PROPOSALS_PAGE_LIMIT } from './proposalFilterQuery';

/**
 * The card's status-row decoration. Only the count — a status badge here would
 * read as the viewer's own assignment status.
 */
export interface ProposalReviewDecoration {
  reviewedLabel?: ReactNode;
}

/** One proposal's aggregates as the table reads them: settled, pending, or gone. */
export type ProposalReviewAggregatesState =
  | { status: 'loading' }
  | { status: 'ready'; aggregates: ProposalReviewAggregates }
  /** The request failed, or this viewer may not see review progress. */
  | { status: 'unavailable' };

const EMPTY_DECORATION: ProposalReviewDecoration = {};

const LOADING_AGGREGATES: ProposalReviewAggregatesState = { status: 'loading' };

const UNAVAILABLE_AGGREGATES: ProposalReviewAggregatesState = {
  status: 'unavailable',
};

const NO_REVIEW_AGGREGATES: ProposalReviewAggregates = {
  assignmentsCount: 0,
  reviewsSubmittedCount: 0,
  outOfDateReviewsCount: 0,
  averageScore: 0,
  overallRecommendationCount: {},
  reviewers: [],
};

interface ProposalReviewDecorationContextValue {
  getDecoration: (proposalId: string) => ProposalReviewDecoration;
  getAggregates: (proposalId: string) => ProposalReviewAggregatesState;
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

  // One query per list page. Appending a page leaves the earlier pages' ids in
  // place, so their keys stay cached while the new page loads, and the ids
  // travel in a GET URL that would otherwise outgrow the server's header limit
  // around 260 proposals.
  const pages = useMemo(
    () => chunk(proposalIds, PROPOSALS_PAGE_LIMIT),
    [proposalIds],
  );

  const results = trpc.useQueries(
    (t) =>
      pages.map((ids) =>
        t.decision.listWithReviewAggregates(
          { processInstanceId, phaseId, proposalIds: ids },
          { enabled, throwOnError: false },
        ),
      ),
    {
      // Only these fields are read, and the combined value keeps its identity
      // until one of them changes; the raw result array is new on every render.
      combine: (pageResults) =>
        pageResults.map(({ data, error, isError }) => ({
          data,
          error,
          isError,
        })),
    },
  );

  const loggedErrors = useRef(new WeakSet<object>());

  useEffect(() => {
    for (const result of results) {
      if (result.error && !loggedErrors.current.has(result.error)) {
        loggedErrors.current.add(result.error);
        logger.error(
          'Failed to load review aggregates for a page of proposals',
          {
            error: result.error,
            processInstanceId,
          },
        );
      }
    }
  }, [results, processInstanceId]);

  const pageIndexByProposalId = useMemo(
    () =>
      new Map(
        pages.flatMap((ids, index) =>
          ids.map((id): [string, number] => [id, index]),
        ),
      ),
    [pages],
  );

  const itemsByProposalId = useMemo(
    () =>
      new Map(
        results
          .flatMap((result) => result.data?.items ?? [])
          .map((item) => [item.proposal.id, item]),
      ),
    [results],
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
    (proposalId: string): ProposalReviewAggregatesState => {
      const pageIndex = pageIndexByProposalId.get(proposalId);
      const result = pageIndex === undefined ? undefined : results[pageIndex];

      if (!enabled) {
        return UNAVAILABLE_AGGREGATES;
      }
      // Counts already on screen outlive a failed refetch: `data` is kept
      // alongside `isError`, so only a page that never loaded is unavailable.
      if (result?.data !== undefined) {
        // A proposal outside the counted phase gets no item: it has no reviews there.
        return {
          status: 'ready',
          aggregates:
            itemsByProposalId.get(proposalId)?.aggregates ??
            NO_REVIEW_AGGREGATES,
        };
      }

      return result?.isError ? UNAVAILABLE_AGGREGATES : LOADING_AGGREGATES;
    },
    [enabled, pageIndexByProposalId, results, itemsByProposalId],
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

export function useProposalReviewAggregates(
  proposalId: string,
): ProposalReviewAggregatesState {
  const context = useContext(ProposalReviewDecorationContext);

  return context?.getAggregates(proposalId) ?? UNAVAILABLE_AGGREGATES;
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
