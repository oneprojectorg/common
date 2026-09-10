'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { Skeleton } from '@op/sense/Skeleton';
import { StatusBadge } from '@op/sense/StatusBadge';
import { type ReactNode, Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ProposalPreview } from '../ProposalPreview';

interface ReviewedVersionPaneProps {
  reviewId: string;
  reviewerName: string;
  /**
   * The current proposal, rendered when the reviewed version turns out to be
   * the current one and when the version read fails — an admin reading a
   * review should never be left with an empty pane.
   */
  currentProposal: ReactNode;
}

/**
 * The proposal as the selected reviewer saw it. Only mounted for a review the
 * aggregates flagged out of date; `isCurrent` still wins, because the server
 * is the only side that knows which history row the review anchors to.
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
        <StatusBadge variant="warning">
          {t('Older version reviewed by {name}', { name: reviewerName })}
        </StatusBadge>
      </div>
      {/* A snapshot whose rich text cannot be rebuilt still renders its
          title, budget, category and author — only the body is missing. */}
      <ProposalPreview
        proposal={version.proposal}
        documentState={version.contentUnavailable ? 'error' : 'ready'}
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
