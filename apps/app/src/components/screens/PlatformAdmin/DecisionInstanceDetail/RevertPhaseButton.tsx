'use client';

import { useTRPC } from '@op/api/client';
import { toast } from '@op/sense/Toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { LuUndo2 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { AdminActionConfirmation } from './AdminActionConfirmation';

/**
 * Platform-admin escape hatch: undo the most recent phase advancement. There
 * is no user-facing equivalent — advancement stays one-way in the product.
 */
export const RevertPhaseButton = ({
  instanceId,
  phaseId,
  previousPhaseName,
}: {
  instanceId: string;
  /** The current phase — the one the instance is moved back out of. */
  phaseId: string;
  previousPhaseName: string;
}) => {
  const trpc = useTRPC();
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const revertPhase = useMutation(
    trpc.platform.admin.revertDecisionPhase.mutationOptions({
      onSuccess: () => {
        toast.success(
          t('admin.phaseRevertedToast', { phase: previousPhaseName }),
        );
        queryClient.invalidateQueries(
          trpc.platform.admin.getDecisionInstance.queryFilter({ instanceId }),
        );
        queryClient.invalidateQueries(
          trpc.platform.admin.listDecisionReviewAssignments.queryFilter({
            instanceId,
          }),
        );
        setIsOpen(false);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  return (
    <AdminActionConfirmation
      trigger={{
        label: t('admin.revertPhaseAction'),
        icon: <LuUndo2 data-icon="inline-start" />,
        variant: 'destructive',
      }}
      title={t('admin.revertPhaseConfirmTitle', { phase: previousPhaseName })}
      description={t('admin.revertPhaseConfirmBody')}
      confirm={{
        label: t('admin.revertPhaseConfirmAction'),
        pendingLabel: t('admin.revertPhaseProgress'),
        variant: 'destructive',
      }}
      isPending={revertPhase.isPending}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      onConfirm={() => revertPhase.mutate({ instanceId, fromPhaseId: phaseId })}
    />
  );
};
