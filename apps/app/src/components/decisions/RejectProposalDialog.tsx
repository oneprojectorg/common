'use client';

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

import { useTranslations } from '@/lib/i18n';

/**
 * Reject-proposal confirmation, shared by the card kebab and the proposal-page
 * overflow menu. Presentational: the caller owns the reject mutation (via
 * {@link useProposalRejectionActions}) and passes `onConfirm` + its pending
 * state, so the toast-with-undo and the menu's Undo item stay on one code path.
 *
 * Rejecting drops the proposal from voting, review, and the default list,
 * leaving it visible only to admins on the proposal list — and it's reversible
 * from the same menu, so this stays a light confirm rather than a reason form.
 */
export const RejectProposalDialog = ({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}) => {
  const t = useTranslations();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('Reject proposal')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              'This removes the proposal from voting, review, and the proposal list. Only admins will still see it. You can undo this afterwards.',
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? t('Rejecting...') : t('Reject proposal')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
