'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { type DecisionAccess, type InstancePhaseData } from '@op/api/encoders';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { Suspense } from 'react';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProposalListSkeleton } from './ProposalListSkeleton';
import { ProposalsList } from './ProposalsList';
import { ProposalReviewDecorationProvider } from './proposalReviewDecoration';

interface AdminReviewProposalsListProps {
  processInstanceId: string;
  slug: string;
  /** Decision profile slug — the per-proposal reviews link is built from it. */
  decisionSlug: string;
  /** Decision profile whose phase copy, updates and resources translate with the list. */
  decisionProfileId?: string | null;
  access?: DecisionAccess;
  /** Current phase; capability flags are derived from `rules`. */
  currentPhase?: InstancePhaseData;
  /** Px offset where the filter bar pins (clears the floating phase toggle). */
  pinOffset?: number;
}

/**
 * The admin's "Proposals in review" surface: the ordinary proposals list, with
 * each card's status row carrying the proposal's review progress — the rollup
 * badge and its completed-review count, visible at zero because "0 Reviewed" is
 * the signal an admin is tracking.
 *
 * It is deliberately the same list: pagination, the category filter, sort and
 * map mode all stay with `proposal.list`, exactly as on every other proposal
 * screen. Only the header and the decoration differ, and the decoration arrives
 * through a provider rather than through the list's props — the surface decides
 * who may see review progress, and the cards read it from context.
 *
 * This is the whole review surface for an admin who is not also a reviewer —
 * there is no assignment queue to tab against, so the list owns its own
 * loading and error states rather than leaning on the page's.
 */
export function AdminReviewProposalsList({
  processInstanceId,
  slug,
  decisionSlug,
  decisionProfileId,
  access,
  currentPhase,
  pinOffset,
}: AdminReviewProposalsListProps) {
  return (
    <APIErrorBoundary
      fallbacks={{ default: () => <AdminReviewProposalsError /> }}
    >
      {/* Outside the Suspense boundary so the reported-proposals state survives
          a re-suspend (a filter change refetches the list, not the aggregates
          the provider already holds). The gate is this surface's: an admin
          needs no `openReviews` to track progress. */}
      <ProposalReviewDecorationProvider
        processInstanceId={processInstanceId}
        decisionSlug={decisionSlug}
        enabled={Boolean(access?.admin)}
        access={access}
      >
        <Suspense fallback={<ProposalListSkeleton />}>
          <ProposalsList
            slug={slug}
            instanceId={processInstanceId}
            decisionSlug={decisionSlug}
            decisionProfileId={decisionProfileId}
            permissions={access}
            currentPhase={currentPhase}
            pinOffset={pinOffset}
            header={(count) => <AdminReviewHeader count={count} />}
          />
        </Suspense>
      </ProposalReviewDecorationProvider>
    </APIErrorBoundary>
  );
}

/** "Proposals in review · 30" — replaces the list's plain proposal count. */
const AdminReviewHeader = ({ count }: { count: number }) => {
  const t = useTranslations();

  return (
    // The count follows the active filter, which changes without a navigation.
    <h2 aria-live="polite" className="font-serif text-title font-light">
      {t('Proposals in review · {count}', { count })}
    </h2>
  );
};

const AdminReviewProposalsError = () => {
  const t = useTranslations();

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuLeaf className="size-6" />
        </EmptyMedia>
        <EmptyTitle>{t("We couldn't load proposals")}</EmptyTitle>
        <EmptyDescription>
          {t('Please refresh the page to try again.')}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
};
