'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type { CategoryWithReviewerStatusSchema } from '@op/common/client';
import { logger } from '@op/logging/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@op/sense/AlertDialog';
import { Button } from '@op/sense/Button';
import {
  FooterBar,
  FooterBarCenter,
  FooterBarEnd,
  FooterBarStart,
} from '@op/sense/FooterBar';
import { Skeleton } from '@op/sense/Skeleton';
import { toast } from '@op/sense/Toast';
import { useFormatter } from 'next-intl';
import { Suspense, useState } from 'react';

import { type TranslateFn, useTranslations } from '@/lib/i18n';

import { getCategoryConfirmedAt } from './developCategoryStatus';
import { getHttpStatus } from './getHttpStatus';

export function DevelopAdminPublishFooter({
  processInstanceId,
  votingStartDate,
}: {
  processInstanceId: string;
  votingStartDate?: string;
}) {
  return (
    <FooterBar position="fixed">
      <FooterBarStart className="min-w-0 shrink">
        {/* Outside Suspense so the live region exists before the count changes. */}
        <div role="status" aria-live="polite" className="min-w-0 text-base">
          <APIErrorBoundary fallbacks={{ default: () => null }}>
            <Suspense fallback={<Skeleton aria-hidden className="h-5 w-48" />}>
              <PublishStatusSuspense processInstanceId={processInstanceId} />
            </Suspense>
          </APIErrorBoundary>
        </div>
      </FooterBarStart>
      <FooterBarCenter />
      <FooterBarEnd>
        <div
          role="status"
          aria-live="polite"
          className="hidden text-sm text-muted-foreground sm:block"
        >
          <APIErrorBoundary fallbacks={{ default: () => null }}>
            <Suspense fallback={null}>
              <WaitingCategoriesSuspense
                processInstanceId={processInstanceId}
              />
            </Suspense>
          </APIErrorBoundary>
        </div>
        <APIErrorBoundary fallbacks={{ default: () => null }}>
          <Suspense fallback={<Skeleton aria-hidden className="h-11 w-36" />}>
            <PublishActionSuspense
              processInstanceId={processInstanceId}
              votingStartDate={votingStartDate}
            />
          </Suspense>
        </APIErrorBoundary>
      </FooterBarEnd>
    </FooterBar>
  );
}

function PublishStatusSuspense({
  processInstanceId,
}: {
  processInstanceId: string;
}) {
  const t = useTranslations('decisions.develop');
  const [{ items }] = trpc.decision.listCategoryReviewerStatus.useSuspenseQuery(
    {
      processInstanceId,
    },
  );
  const { advancing, confirmed, assigned } = getPublishTotals(items);

  if (assigned === 0) {
    return t('noMappedCategoriesStatus');
  }

  return t('advancingAcrossCategories', { advancing, confirmed });
}

function WaitingCategoriesSuspense({
  processInstanceId,
}: {
  processInstanceId: string;
}) {
  const t = useTranslations('decisions.develop');
  const [{ items }] = trpc.decision.listCategoryReviewerStatus.useSuspenseQuery(
    {
      processInstanceId,
    },
  );
  const waitingCount = items.filter(
    (status) =>
      status.reviewers.length > 0 && getCategoryConfirmedAt(status) === null,
  ).length;

  if (waitingCount === 0) {
    return null;
  }

  return t('waitingOnCategories', { count: waitingCount });
}

function PublishActionSuspense({
  processInstanceId,
  votingStartDate,
}: {
  processInstanceId: string;
  votingStartDate?: string;
}) {
  const t = useTranslations('decisions.develop');
  const tShared = useTranslations();
  const format = useFormatter();
  const [isOpen, setIsOpen] = useState(false);
  const [{ canPublish }] =
    trpc.decision.getDevelopConfirmState.useSuspenseQuery({
      processInstanceId,
    });
  const [{ items }] = trpc.decision.listCategoryReviewerStatus.useSuspenseQuery(
    {
      processInstanceId,
    },
  );
  const { advancing, confirmed } = getPublishTotals(items);
  const description = votingStartDate
    ? t('publishVotingDescription', {
        count: advancing,
        categories: confirmed,
        date: format.dateTime(new Date(votingStartDate), {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
      })
    : t('publishDescription', { count: advancing, categories: confirmed });
  const publish = trpc.decision.publishDevelopedProposals.useMutation({
    onSuccess: () => {
      setIsOpen(false);
      toast.success(t('publishSuccess'));
    },
    onError: (error) => {
      logger.error('Failed to publish developed proposals', { error });
      setIsOpen(false);
      toast.error(getPublishErrorMessage({ status: getHttpStatus(error), t }));
    },
  });

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger render={<Button disabled={!canPublish} />}>
        {t('publishAction')}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('publishTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tShared('Cancel')}</AlertDialogCancel>
          <AlertDialogAction
            loading={publish.isPending}
            disabled={!canPublish}
            onClick={() => publish.mutate({ processInstanceId })}
          >
            {t('publishAction')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function getPublishTotals(items: CategoryWithReviewerStatusSchema[]) {
  const assigned = items.filter((status) => status.reviewers.length > 0);
  return {
    advancing: items.reduce(
      (total, status) => total + status.advancingCount,
      0,
    ),
    confirmed: assigned.filter(
      (status) => getCategoryConfirmedAt(status) !== null,
    ).length,
    assigned: assigned.length,
  };
}

function getPublishErrorMessage({
  status,
  t,
}: {
  status: number | undefined;
  t: TranslateFn<'decisions.develop'>;
}): string {
  if (status === 400) {
    return t('publishNotConfirmedError');
  }

  if (status === 409) {
    return t('alreadyPublishedError');
  }

  return t('publishError');
}
