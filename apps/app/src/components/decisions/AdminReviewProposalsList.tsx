'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { type DecisionAccess, type InstancePhaseData } from '@op/api/encoders';
import { Suspense } from 'react';

import { ProposalListSkeleton } from './ProposalListSkeleton';
import { ProposalReviewProgressTable } from './ProposalReviewProgressTable';
import { ProposalsList } from './ProposalsList';
import { ProposalsLoadError } from './ProposalsLoadError';
import { ProposalReviewDecorationProvider } from './proposalReviewDecoration';

interface AdminReviewProposalsListProps {
  processInstanceId: string;
  slug: string;
  /** Decision profile slug — the per-proposal reviews link is built from it. */
  decisionSlug: string;
  access?: DecisionAccess;
  /** Current phase; capability flags are derived from `rules`. */
  currentPhase?: InstancePhaseData;
  /** Px offset where the filter bar pins (clears the floating phase toggle). */
  pinOffset?: number;
}

/**
 * The admin's "All proposals" surface: the ordinary proposals list, with
 * each card's status row carrying the proposal's review progress — the rollup
 * badge and its completed-review count, visible at zero because "0 Reviewed" is
 * the signal an admin is tracking.
 *
 * It is deliberately the same list: pagination, the category filter, sort and
 * map mode all stay with `proposal.list`, exactly as on every other proposal
 * screen. Only the decoration and one extra view differ: the review progress
 * table, shown first. The review data arrives through a provider rather than
 * through the list's props — the surface decides who may see review progress,
 * and the cards and the table read it from context.
 *
 * This is the whole review surface for an admin who is not also a reviewer —
 * there is no assignment queue to tab against, so the list owns its own
 * loading and error states rather than leaning on the page's.
 */
export function AdminReviewProposalsList({
  processInstanceId,
  slug,
  decisionSlug,
  access,
  currentPhase,
  pinOffset,
}: AdminReviewProposalsListProps) {
  return (
    <APIErrorBoundary fallbacks={{ default: () => <ProposalsLoadError /> }}>
      {/* Outside the Suspense boundary so the reported-proposals state survives
          a re-suspend (a filter change refetches the list, not the aggregates
          the provider already holds). The gate is this surface's: an admin
          needs no `openReviews` to track progress. */}
      <ProposalReviewDecorationProvider
        processInstanceId={processInstanceId}
        decisionSlug={decisionSlug}
        enabled={Boolean(access?.admin)}
        canOpenReviews={Boolean(access?.admin)}
      >
        <Suspense fallback={<ProposalListSkeleton />}>
          <ProposalsList
            slug={slug}
            instanceId={processInstanceId}
            decisionSlug={decisionSlug}
            permissions={access}
            currentPhase={currentPhase}
            pinOffset={pinOffset}
            compactSearch
            renderTable={({ proposals, emptyState }) => (
              <ProposalReviewProgressTable
                proposals={proposals}
                decisionSlug={decisionSlug}
                emptyState={emptyState}
              />
            )}
          />
        </Suspense>
      </ProposalReviewDecorationProvider>
    </APIErrorBoundary>
  );
}
