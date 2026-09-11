'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { Skeleton } from '@op/sense/Skeleton';
import { StatusBadge } from '@op/sense/StatusBadge';
import { type ReactNode, Suspense } from 'react';
import { LuRefreshCw } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProposalPreview } from '../ProposalPreview';

interface ReviewedVersionPaneProps {
  reviewId: string;
  reviewerName: string;
  /**
   * Rendered when the reviewed version is the current one and when the version
   * read fails, so the pane is never left empty.
   */
  currentProposal: ReactNode;
}

/**
 * The proposal as the selected reviewer saw it. `isCurrent` overrides the
 * aggregates' stale flag: only the server knows which history row is anchored.
 */
export function ReviewedVersionPane({
  reviewId,
  reviewerName,
  currentProposal,
}: ReviewedVersionPaneProps) {
  return (
    <APIErrorBoundary fallbacks={{ default: () => currentProposal }}>
      <Suspense fallback={<ReviewedVersionSkeleton />}>
        <ReviewedVersion
          reviewId={reviewId}
          reviewerName={reviewerName}
          currentProposal={currentProposal}
        />
      </Suspense>
    </APIErrorBoundary>
  );
}

function ReviewedVersion({
  reviewId,
  reviewerName,
  currentProposal,
}: ReviewedVersionPaneProps) {
  const t = useTranslations();
  const [version] = trpc.decision.getReviewedVersion.useSuspenseQuery({
    reviewId,
  });

  if (version.isCurrent) {
    return currentProposal;
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-10">
      <div className="flex">
        <StatusBadge variant="revision" icon={LuRefreshCw}>
          {t('Older version reviewed by {name}', { name: reviewerName })}
        </StatusBadge>
      </div>
      {/* A snapshot whose rich text cannot be rebuilt still renders its
          title, budget, category and author — only the body is missing. */}
      <ProposalPreview
        proposal={version.proposal}
        documentState={
          version.proposal.documentContent?.type === 'unavailable'
            ? 'error'
            : 'ready'
        }
        documentUnavailableMessage={t(
          'This older version of the content is no longer available',
        )}
      />
    </div>
  );
}

function ReviewedVersionSkeleton() {
  return (
    <div className="flex flex-col gap-6 sm:gap-10">
      <Skeleton className="h-9 w-72" />
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-4/5" />
        <div className="flex gap-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-7 w-28" />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}
