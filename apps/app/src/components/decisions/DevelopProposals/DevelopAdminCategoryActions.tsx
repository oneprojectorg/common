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
import { type ComponentProps, type ReactNode, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { getHttpStatus } from './getHttpStatus';

interface CategoryActionProps {
  processInstanceId: string;
  category: { id: string; name: string };
}

/**
 * Confirms every facilitator's develop work in one category, on their
 * behalf, after a dialog. No invalidation: the confirm publishes on the
 * channels the categories tab, the publish footer and the editors read.
 */
export function ConfirmCategoryAction({
  processInstanceId,
  category,
}: CategoryActionProps) {
  const t = useTranslations('decisions.develop');
  const [isOpen, setIsOpen] = useState(false);
  const confirm = trpc.decision.confirmCategoryDevelopment.useMutation({
    onSuccess: () => {
      setIsOpen(false);
      toast.success(t('categoryConfirmedSuccess'));
    },
    onError: (error) => {
      logger.error('Failed to confirm category development', { error });
      toast.error(
        getHttpStatus(error) === 400
          ? t('developClosedError')
          : t('confirmCategoryError'),
      );
    },
  });

  return (
    <CategoryActionDialog
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      trigger={
        <Button
          size="sm"
          aria-label={t('confirmCategoryLabel', { category: category.name })}
        />
      }
      triggerLabel={t('confirmSelectionsAction')}
      title={t.rich('confirmCategorySelectionsTitle', {
        category: category.name,
        bdi: (chunks) => <bdi>{chunks}</bdi>,
      })}
      description={t('adminConfirmCategoryDescription')}
      isPending={confirm.isPending}
      onAction={() =>
        confirm.mutate({ processInstanceId, taxonomyTermId: category.id })
      }
    />
  );
}

/**
 * Clears every facilitator's confirm in one category after a dialog, so they
 * can change their develop work again.
 */
export function UnconfirmCategoryAction({
  processInstanceId,
  category,
}: CategoryActionProps) {
  const t = useTranslations('decisions.develop');
  const [isOpen, setIsOpen] = useState(false);
  const unconfirm = trpc.decision.unconfirmCategoryDevelopment.useMutation({
    onSuccess: () => {
      setIsOpen(false);
      toast.success(t('categoryUnconfirmedSuccess'));
    },
    onError: (error) => {
      logger.error('Failed to unconfirm category development', { error });
      toast.error(
        getHttpStatus(error) === 400
          ? t('developClosedError')
          : t('unconfirmCategoryError'),
      );
    },
  });

  return (
    <CategoryActionDialog
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      trigger={
        <Button
          size="sm"
          variant="outline"
          aria-label={t('unconfirmCategoryLabel', { category: category.name })}
        />
      }
      triggerLabel={t('unconfirmSelectionsAction')}
      title={t.rich('unconfirmCategorySelectionsTitle', {
        category: category.name,
        bdi: (chunks) => <bdi>{chunks}</bdi>,
      })}
      description={t('adminUnconfirmCategoryDescription')}
      isPending={unconfirm.isPending}
      onAction={() =>
        unconfirm.mutate({ processInstanceId, taxonomyTermId: category.id })
      }
    />
  );
}

/** The dialog both actions share; the action button repeats the trigger's label. */
function CategoryActionDialog({
  isOpen,
  onOpenChange,
  trigger,
  triggerLabel,
  title,
  description,
  isPending,
  onAction,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ComponentProps<typeof AlertDialogTrigger>['render'];
  triggerLabel: string;
  title: ReactNode;
  description: string;
  isPending: boolean;
  onAction: () => void;
}) {
  const tShared = useTranslations();

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogTrigger render={trigger}>{triggerLabel}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tShared('Cancel')}</AlertDialogCancel>
          <AlertDialogAction loading={isPending} onClick={onAction}>
            {triggerLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
