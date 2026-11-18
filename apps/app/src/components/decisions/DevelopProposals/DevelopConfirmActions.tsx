'use client';

import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import { nextCursor } from '@op/common/client';
import { logger } from '@op/logging/client';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@op/sense/Dialog';
import { Skeleton } from '@op/sense/Skeleton';
import { toast } from '@op/sense/Toast';
import { Suspense, useEffect, useState } from 'react';
import { LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { type DevelopSourcesInput, isSourceAdvancing } from './developSources';
import { getHttpStatus } from './getHttpStatus';

interface ConfirmActionProps {
  processInstanceId: string;
  /** The caller's categories for the current phase; one names the dialog. */
  categoryNames: string[];
}

/**
 * Confirms all of the caller's develop work for the current phase after a
 * dialog that counts the caller's sources that advance and those that do not.
 * Disabled while nothing is advancing. No invalidation: the confirm publishes
 * on the channels the develop screen and the editor subscribe to.
 */
export function ConfirmSelectionsAction({
  processInstanceId,
  categoryNames,
  advancingCount,
  sourcesInput,
}: ConfirmActionProps & {
  advancingCount: number;
  /** The sources table's query input. Omit when the phase has no sources. */
  sourcesInput?: DevelopSourcesInput;
}) {
  const t = useTranslations('decisions.develop');
  const tShared = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const confirm = trpc.decision.confirmCategoryDevelopment.useMutation({
    onSuccess: () => {
      setIsOpen(false);
      toast.success(t('selectionsConfirmedSuccess'));
    },
    onError: (error) => {
      logger.error('Failed to confirm develop selections', { error });
      toast.error(
        getHttpStatus(error) === 409
          ? t('selectionsAlreadyConfirmedError')
          : t('confirmSelectionsError'),
      );
    },
  });
  const categoryName = getSingleCategoryName(categoryNames);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={<Button disabled={advancingCount === 0} />}>
        {t('confirmSelectionsAction')}
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {categoryName === null
              ? t('confirmSelectionsTitle')
              : t.rich('confirmCategorySelectionsTitle', {
                  category: categoryName,
                  bdi: (chunks) => <bdi>{chunks}</bdi>,
                })}
          </DialogTitle>
          <div aria-live="polite">
            {sourcesInput ? (
              <APIErrorBoundary
                fallbacks={{
                  default: () => (
                    <DialogDescription>
                      {tShared('decisions.proposals.proposalsLoadError')}
                    </DialogDescription>
                  ),
                }}
              >
                <Suspense fallback={<Skeleton className="h-12 w-full" />}>
                  <ConfirmSelectionsDescription sourcesInput={sourcesInput} />
                </Suspense>
              </APIErrorBoundary>
            ) : (
              <DialogDescription>
                {t('confirmSelectionsDescription', {
                  count: 0,
                  notAdvancedCount: 0,
                })}
              </DialogDescription>
            )}
          </div>
        </DialogHeader>
        <DialogCloseButton />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {tShared('Cancel')}
          </DialogClose>
          <Button
            loading={confirm.isPending}
            onClick={() => confirm.mutate({ processInstanceId })}
          >
            {t('confirmSelectionsAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Takes back the caller's confirm after a dialog, so they can change their
 * develop work again.
 */
export function UnconfirmSelectionsAction({
  processInstanceId,
  categoryNames,
}: ConfirmActionProps) {
  const t = useTranslations('decisions.develop');
  const tShared = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const unconfirm = trpc.decision.unconfirmCategoryDevelopment.useMutation({
    onSuccess: () => {
      setIsOpen(false);
      toast.success(t('selectionsUnconfirmedSuccess'));
    },
    onError: (error) => {
      logger.error('Failed to unconfirm develop selections', { error });
      toast.error(t('unconfirmSelectionsError'));
    },
  });
  const categoryName = getSingleCategoryName(categoryNames);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        {t('unconfirmSelectionsAction')}
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {categoryName === null
              ? t('unconfirmSelectionsTitle')
              : t.rich('unconfirmCategorySelectionsTitle', {
                  category: categoryName,
                  bdi: (chunks) => <bdi>{chunks}</bdi>,
                })}
          </DialogTitle>
          <DialogDescription>
            {t('unconfirmSelectionsDescription')}
          </DialogDescription>
        </DialogHeader>
        <DialogCloseButton />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {tShared('Cancel')}
          </DialogClose>
          <Button
            loading={unconfirm.isPending}
            onClick={() => unconfirm.mutate({ processInstanceId })}
          >
            {t('unconfirmSelectionsAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * How many of the caller's sources advance and how many do not. Both counts
 * cover every source, so the pages the sources table has not loaded load here.
 */
function ConfirmSelectionsDescription({
  sourcesInput,
}: {
  sourcesInput: DevelopSourcesInput;
}) {
  const t = useTranslations('decisions.develop');
  const [
    data,
    {
      hasNextPage,
      isFetchingNextPage,
      isFetchNextPageError,
      error,
      fetchNextPage,
    },
  ] = trpc.decision.listDevelopSources.useSuspenseInfiniteQuery(sourcesInput, {
    getNextPageParam: nextCursor,
  });

  const shouldLoadNextPage =
    hasNextPage && !isFetchingNextPage && !isFetchNextPageError;
  useEffect(() => {
    if (shouldLoadNextPage) {
      void fetchNextPage();
    }
  }, [shouldLoadNextPage, fetchNextPage]);

  if (isFetchNextPageError) {
    throw error;
  }

  if (hasNextPage) {
    return <Skeleton className="h-12 w-full" />;
  }

  const sources = data.pages.flatMap((page) => page.items);
  const advancingCount = sources.filter(isSourceAdvancing).length;

  return (
    <DialogDescription>
      {t('confirmSelectionsDescription', {
        count: advancingCount,
        notAdvancedCount: sources.length - advancingCount,
      })}
    </DialogDescription>
  );
}

/** The built-in close button's label is not translated, so this one replaces it. */
function DialogCloseButton() {
  const t = useTranslations();

  return (
    <DialogClose
      render={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('Close')}
          className="fixed end-4 top-4 z-20 opacity-70 hover:bg-transparent hover:opacity-100 sm:absolute"
        />
      }
    >
      <LuX aria-hidden />
    </DialogClose>
  );
}

/** The one category the caller's rows cover, or `null` for several. */
function getSingleCategoryName(categoryNames: string[]): string | null {
  return categoryNames.length === 1 ? (categoryNames[0] ?? null) : null;
}
