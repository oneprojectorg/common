'use client';

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
import { toast } from '@op/sense/Toast';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { getHttpStatus } from './getHttpStatus';

interface ConfirmActionProps {
  processInstanceId: string;
  /** The caller's categories for the current phase; one names the dialog. */
  categoryNames: string[];
}

/**
 * Confirms all of the caller's develop work for the current phase after a
 * dialog. Disabled while nothing is advancing. No invalidation: the confirm
 * publishes on the channels the develop screen and the editor subscribe to.
 */
export function ConfirmSelectionsAction({
  processInstanceId,
  categoryNames,
  advancingCount,
}: ConfirmActionProps & { advancingCount: number }) {
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
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger render={<Button disabled={advancingCount === 0} />}>
        {t('confirmSelectionsAction')}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {categoryName === null
              ? t('confirmSelectionsTitle')
              : t.rich('confirmCategorySelectionsTitle', {
                  category: categoryName,
                  bdi: (chunks) => <bdi>{chunks}</bdi>,
                })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('confirmSelectionsDescription', { count: advancingCount })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tShared('Cancel')}</AlertDialogCancel>
          <AlertDialogAction
            loading={confirm.isPending}
            onClick={() => confirm.mutate({ processInstanceId })}
          >
            {t('confirmSelectionsAction')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger render={<Button variant="outline" />}>
        {t('unconfirmSelectionsAction')}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {categoryName === null
              ? t('unconfirmSelectionsTitle')
              : t.rich('unconfirmCategorySelectionsTitle', {
                  category: categoryName,
                  bdi: (chunks) => <bdi>{chunks}</bdi>,
                })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('unconfirmSelectionsDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tShared('Cancel')}</AlertDialogCancel>
          <AlertDialogAction
            loading={unconfirm.isPending}
            onClick={() => unconfirm.mutate({ processInstanceId })}
          >
            {t('unconfirmSelectionsAction')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** The one category the caller's rows cover, or `null` for several. */
function getSingleCategoryName(categoryNames: string[]): string | null {
  return categoryNames.length === 1 ? (categoryNames[0] ?? null) : null;
}
