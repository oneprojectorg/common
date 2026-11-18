'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
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
import { Suspense, useState } from 'react';

import { type TranslateFn, useTranslations } from '@/lib/i18n';

import { isCategoryConfirmed } from './developCategoryStatus';
import { getHttpStatus } from './getHttpStatus';

export function DevelopAdminPublishFooter({
  processInstanceId,
}: {
  processInstanceId: string;
}) {
  return (
    <FooterBar position="fixed">
      <FooterBarStart>
        {/* Outside Suspense so the live region exists before the count changes. */}
        <div role="status" aria-live="polite" className="text-base">
          <APIErrorBoundary fallbacks={{ default: () => null }}>
            <Suspense fallback={<Skeleton aria-hidden className="h-5 w-48" />}>
              <PublishStatusSuspense processInstanceId={processInstanceId} />
            </Suspense>
          </APIErrorBoundary>
        </div>
      </FooterBarStart>
      <FooterBarCenter />
      <FooterBarEnd>
        <APIErrorBoundary fallbacks={{ default: () => null }}>
          <Suspense fallback={<Skeleton aria-hidden className="h-11 w-36" />}>
            <PublishActionSuspense processInstanceId={processInstanceId} />
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
  const mappedCount = items.reduce(
    (count, status) => (status.reviewers.length > 0 ? count + 1 : count),
    0,
  );
  const confirmedCount = items.reduce(
    (count, status) => (isCategoryConfirmed(status) ? count + 1 : count),
    0,
  );

  if (mappedCount === 0) {
    return t('noMappedCategoriesStatus');
  }

  return t('categoriesConfirmedCount', {
    confirmed: confirmedCount,
    total: mappedCount,
  });
}

function PublishActionSuspense({
  processInstanceId,
}: {
  processInstanceId: string;
}) {
  const t = useTranslations('decisions.develop');
  const tShared = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const [{ canPublish }] =
    trpc.decision.getDevelopConfirmState.useSuspenseQuery({
      processInstanceId,
    });
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
          <AlertDialogDescription>
            {t('publishDescription')}
          </AlertDialogDescription>
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
