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

interface SubmitProposalConfirmModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Runs the submission. The caller closes the dialog first — `AlertDialogAction`
   * is a plain `Button` and dismisses nothing on its own.
   */
  onConfirm: () => void;
}

/**
 * Confirms a draft submission the author can't take back, shown only when the
 * current phase forbids editing after submission — see
 * `requiresSubmitConfirmation`. "Keep editing" returns to the editor with the
 * proposal still a draft.
 */
export function SubmitProposalConfirmModal({
  isOpen,
  onOpenChange,
  onConfirm,
}: SubmitProposalConfirmModalProps) {
  const t = useTranslations();

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('Submitting is final')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("You won't be able to edit your proposal after submitting")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('Keep editing')}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t('Submit')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
