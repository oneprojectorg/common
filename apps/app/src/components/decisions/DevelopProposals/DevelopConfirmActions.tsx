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
import {
  FooterBar,
  FooterBarCenter,
  FooterBarEnd,
  FooterBarStart,
} from '@op/sense/FooterBar';
import { Skeleton } from '@op/sense/Skeleton';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import { type ReactNode, Suspense, useEffect, useState } from 'react';
import { LuCircleCheck, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { type DevelopSourcesInput, isSourceAdvancing } from './developSources';
import { getHttpStatus } from './getHttpStatus';

interface ConfirmActionProps {
  processInstanceId: string;
  /** The caller's categories for the current phase; one names the dialog. */
  categoryNames: string[];
}

interface SelectionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** The dialog's description, `DialogDescription` included. */
  description: ReactNode;
  isPending: boolean;
  onSubmit: () => void;
}

// A type, not an interface, so it passes as the values of a translation.
type AdvanceCounts = {
  count: number;
  notAdvancedCount: number;
};

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
    <ConfirmSelectionsDialog
      open={isOpen}
      onOpenChange={setIsOpen}
      disabled={advancingCount === 0}
      title={
        categoryName === null
          ? t('confirmSelectionsTitle')
          : t.rich('confirmCategorySelectionsTitle', {
              category: categoryName,
              bdi: (chunks) => <bdi>{chunks}</bdi>,
            })
      }
      description={
        <SourcesAdvanceDescription
          sourcesInput={sourcesInput}
          renderDescription={(counts) =>
            t('confirmSelectionsDescription', counts)
          }
        />
      }
      isPending={confirm.isPending}
      onSubmit={() => confirm.mutate({ processInstanceId })}
    />
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
    <UnconfirmSelectionsDialog
      open={isOpen}
      onOpenChange={setIsOpen}
      title={
        categoryName === null
          ? t('unconfirmSelectionsTitle')
          : t.rich('unconfirmCategorySelectionsTitle', {
              category: categoryName,
              bdi: (chunks) => <bdi>{chunks}</bdi>,
            })
      }
      description={
        <DialogDescription>
          {t('unconfirmSelectionsDescription')}
        </DialogDescription>
      }
      isPending={unconfirm.isPending}
      onSubmit={() => unconfirm.mutate({ processInstanceId })}
    />
  );
}

/** The fixed footer of a develop screen: the advancing count and the confirm action. */
export function DevelopConfirmFooter({
  advancingCount,
  children,
}: {
  advancingCount: number;
  /** The confirm or unconfirm action. */
  children: ReactNode;
}) {
  const t = useTranslations('decisions.develop');

  return (
    <FooterBar position="fixed">
      <FooterBarStart>
        <p aria-live="polite" className="flex items-center gap-2 text-base">
          <LuCircleCheck
            aria-hidden
            className={cn(
              'size-4 shrink-0',
              advancingCount > 0 ? 'text-primary' : 'text-muted-foreground',
            )}
          />
          {t('advancingCount', { count: advancingCount })}
        </p>
      </FooterBarStart>
      <FooterBarCenter />
      <FooterBarEnd>
        {/* Polite, so the swap between Confirm and Unconfirm is announced. */}
        <div aria-live="polite">{children}</div>
      </FooterBarEnd>
    </FooterBar>
  );
}

/** Confirm selections, and the dialog that asks before it confirms. */
export function ConfirmSelectionsDialog({
  open,
  onOpenChange,
  disabled,
  title,
  description,
  isPending,
  onSubmit,
}: SelectionsDialogProps & { disabled: boolean }) {
  const t = useTranslations('decisions.develop');
  const tShared = useTranslations();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button disabled={disabled} />}>
        {t('confirmSelectionsAction')}
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <div aria-live="polite">{description}</div>
        </DialogHeader>
        <DialogCloseButton />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {tShared('Cancel')}
          </DialogClose>
          <Button loading={isPending} onClick={onSubmit}>
            {t('confirmSelectionsAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Unconfirm selections, and the dialog that asks before it unconfirms. */
export function UnconfirmSelectionsDialog({
  open,
  onOpenChange,
  title,
  description,
  isPending,
  onSubmit,
}: SelectionsDialogProps) {
  const t = useTranslations('decisions.develop');
  const tShared = useTranslations();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="outline" />}>
        {t('unconfirmSelectionsAction')}
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description}
        </DialogHeader>
        <DialogCloseButton />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {tShared('Cancel')}
          </DialogClose>
          <Button loading={isPending} onClick={onSubmit}>
            {t('unconfirmSelectionsAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The dialog description built from how many of the listed sources advance
 * and how many do not. Without sources, both counts are 0.
 */
export function SourcesAdvanceDescription({
  sourcesInput,
  renderDescription,
}: {
  /** The sources table's query input. Omit when the phase has no sources. */
  sourcesInput?: DevelopSourcesInput;
  renderDescription: (counts: AdvanceCounts) => string;
}) {
  const tShared = useTranslations();

  if (!sourcesInput) {
    return (
      <DialogDescription>
        {renderDescription({ count: 0, notAdvancedCount: 0 })}
      </DialogDescription>
    );
  }

  return (
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
        <ConfirmSelectionsDescription
          sourcesInput={sourcesInput}
          renderDescription={renderDescription}
        />
      </Suspense>
    </APIErrorBoundary>
  );
}

/**
 * How many of the listed sources advance and how many do not. Both counts
 * cover every source, so the pages the sources table has not loaded load here.
 */
function ConfirmSelectionsDescription({
  sourcesInput,
  renderDescription,
}: {
  sourcesInput: DevelopSourcesInput;
  renderDescription: (counts: AdvanceCounts) => string;
}) {
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
      {renderDescription({
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
