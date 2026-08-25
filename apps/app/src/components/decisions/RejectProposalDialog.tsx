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
} from '@op/sense/AlertDialog';
import { toast } from '@op/sense/Toast';

import { useTranslations } from '@/lib/i18n';

/**
 * Reject-proposal confirmation. Owns the reject mutation + toasts so both entry
 * points (the card kebab and the proposal-page `…` menu) share one dialog and
 * behavior. Always controlled: open it via `onOpenChange`.
 *
 * Rejecting is a plain status change (no reason/note yet — ONE-931): it drops
 * the proposal from voting, review, and the default list, leaving it visible
 * only to admins on the proposal list, like a flagged proposal.
 */
export const RejectProposalDialog = ({
  proposalId,
  open,
  onOpenChange,
  onRejected,
}: {
  proposalId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs after a successful reject — e.g. leave the page you just rejected. */
  onRejected?: () => void;
}) => {
  const t = useTranslations();

  // No invalidation needed: the endpoint registers the affected proposal channels.
  // On error the dialog stays open (only onSuccess closes it) so the user can retry.
  const rejectMutation = trpc.decision.rejectProposal.useMutation({
    onSuccess: () => {
      toast.success(t('Proposal rejected'));
      onOpenChange(false);
      onRejected?.();
    },
    onError: (error) => {
      logger.error('Failed to reject proposal', {
        error,
        context: 'RejectProposalDialog',
      });
      toast.error(
        error.message || t('Could not reject this proposal. Please try again.'),
      );
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('Reject proposal')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              'This removes the proposal from voting, review, and the proposal list. Only admins will still see it. You can restore it later by changing its status.',
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => rejectMutation.mutate({ proposalId })}
            disabled={rejectMutation.isPending}
          >
            {rejectMutation.isPending
              ? t('Rejecting...')
              : t('Reject proposal')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
