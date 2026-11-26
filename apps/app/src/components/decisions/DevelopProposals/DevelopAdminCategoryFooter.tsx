'use client';

import { trpc } from '@op/api/client';
import type { CategoryWithReviewerStatusSchema } from '@op/common/client';
import { logger } from '@op/logging/client';
import { DialogDescription } from '@op/sense/Dialog';
import { toast } from '@op/sense/Toast';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  ConfirmSelectionsDialog,
  DevelopConfirmFooter,
  SourcesAdvanceDescription,
  UnconfirmSelectionsDialog,
} from './DevelopConfirmActions';
import { getCategoryConfirmedAt } from './developCategoryStatus';
import type { DevelopSourcesInput } from './developSources';

interface CategoryActionProps {
  processInstanceId: string;
  category: CategoryWithReviewerStatusSchema['category'];
}

/**
 * The admin's footer on one category: its advancing count, and Confirm or
 * Unconfirm for every reviewer row of the category. A category with no
 * reviewer has no row to confirm, so it gets no action.
 */
export function DevelopAdminCategoryFooter({
  processInstanceId,
  status,
  sourcesInput,
}: {
  processInstanceId: string;
  status: CategoryWithReviewerStatusSchema;
  /** The category's sources query input. Omit when the phase has no sources. */
  sourcesInput?: DevelopSourcesInput;
}) {
  return (
    <DevelopConfirmFooter advancingCount={status.advancingCount}>
      <CategoryAction
        processInstanceId={processInstanceId}
        status={status}
        sourcesInput={sourcesInput}
      />
    </DevelopConfirmFooter>
  );
}

function CategoryAction({
  processInstanceId,
  status,
  sourcesInput,
}: {
  processInstanceId: string;
  status: CategoryWithReviewerStatusSchema;
  sourcesInput?: DevelopSourcesInput;
}) {
  if (status.reviewers.length === 0) {
    return null;
  }

  if (getCategoryConfirmedAt(status) !== null) {
    return (
      <UnconfirmCategoryAction
        processInstanceId={processInstanceId}
        category={status.category}
      />
    );
  }

  return (
    <ConfirmCategoryAction
      processInstanceId={processInstanceId}
      category={status.category}
      advancingCount={status.advancingCount}
      sourcesInput={sourcesInput}
    />
  );
}

function ConfirmCategoryAction({
  processInstanceId,
  category,
  advancingCount,
  sourcesInput,
}: CategoryActionProps & {
  advancingCount: number;
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
      logger.error('Failed to confirm a category for an admin', { error });
      toast.error(t('confirmCategorySelectionsError'));
    },
  });

  return (
    <ConfirmSelectionsDialog
      open={isOpen}
      onOpenChange={setIsOpen}
      disabled={advancingCount === 0}
      title={t.rich('confirmCategorySelectionsTitle', {
        category: category.name,
        bdi: (chunks) => <bdi>{chunks}</bdi>,
      })}
      description={
        <SourcesAdvanceDescription
          sourcesInput={sourcesInput}
          renderDescription={(counts) =>
            t('confirmCategorySelectionsDescription', counts)
          }
        />
      }
      isPending={confirm.isPending}
      onSubmit={() =>
        confirm.mutate({ processInstanceId, taxonomyTermId: category.id })
      }
    />
  );
}

function UnconfirmCategoryAction({
  processInstanceId,
  category,
}: CategoryActionProps) {
  const t = useTranslations('decisions.develop');
  const [isOpen, setIsOpen] = useState(false);
  const unconfirm = trpc.decision.unconfirmCategoryDevelopment.useMutation({
    onSuccess: () => {
      setIsOpen(false);
      toast.success(t('selectionsUnconfirmedSuccess'));
    },
    onError: (error) => {
      logger.error('Failed to unconfirm a category for an admin', { error });
      toast.error(t('unconfirmCategorySelectionsError'));
    },
  });

  return (
    <UnconfirmSelectionsDialog
      open={isOpen}
      onOpenChange={setIsOpen}
      title={t.rich('unconfirmCategorySelectionsTitle', {
        category: category.name,
        bdi: (chunks) => <bdi>{chunks}</bdi>,
      })}
      description={
        <DialogDescription>
          {t('unconfirmCategorySelectionsDescription')}
        </DialogDescription>
      }
      isPending={unconfirm.isPending}
      onSubmit={() =>
        unconfirm.mutate({ processInstanceId, taxonomyTermId: category.id })
      }
    />
  );
}
