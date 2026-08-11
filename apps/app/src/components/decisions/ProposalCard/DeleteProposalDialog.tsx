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
import { toast } from '@op/sense/Toast';
import type { ReactElement } from 'react';

import { useTranslations } from '@/lib/i18n';

/**
 * The single delete-proposal confirmation. Owns the delete mutation + toasts so
 * both entry points (the owner action bar's Delete button and the card's "…"
 * menu) share one dialog, copy, and behavior. Always controlled; pass `trigger`
 * to wire a button that opens it, or omit it and open via `onOpenChange`.
 */
export const DeleteProposalDialog = ({
  proposalId,
  open,
  onOpenChange,
  trigger,
  onDeleted,
}: {
  proposalId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional opener (e.g. the Delete button). Omit when opened imperatively. */
  trigger?: ReactElement;
  /** Runs after a successful delete — e.g. leave the page you just deleted. */
  onDeleted?: () => void;
}) => {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const deleteProposalMutation = trpc.decision.deleteProposal.useMutation({
    onError: (error) => {
      toast.error(error.message || t('Failed to delete proposal'));
    },
    onSuccess: () => {
      toast.success(t('Proposal deleted successfully'));
      // Nothing else drops the deleted row, so any list still holding it —
      // the grid, the map, the ballot — would keep rendering it.
      utils.decision.invalidate();
    },
  });

  const handleDelete = async () => {
    try {
      await deleteProposalMutation.mutateAsync({ proposalId });
      onOpenChange(false);
      onDeleted?.();
    } catch (error) {
      // Error already surfaced via the mutation's onError toast; keep the
      // dialog open so the user can retry.
      logger.error('Failed to delete proposal', {
        error,
        context: 'DeleteProposalDialog',
      });
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <AlertDialogTrigger render={trigger} /> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('Delete Proposal')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              'Are you sure you want to delete this proposal? This action cannot be undone.',
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteProposalMutation.isPending}
          >
            {deleteProposalMutation.isPending ? t('Deleting...') : t('Delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
