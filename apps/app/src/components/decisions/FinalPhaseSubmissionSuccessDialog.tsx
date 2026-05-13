'use client';

import { Button } from '@op/ui/Button';
import { Dialog } from '@op/ui/Dialog';
import { Modal } from '@op/ui/Modal';
import { LuCircleCheck } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

interface FinalPhaseSubmissionSuccessDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * One-shot celebration modal shown to the submitting admin after the final-phase
 * selection is confirmed (Figma 2310-11489). Dismissal reveals the ResultsPage
 * already mounted underneath via channel invalidation.
 */
export const FinalPhaseSubmissionSuccessDialog = ({
  isOpen,
  onOpenChange,
}: FinalPhaseSubmissionSuccessDialogProps) => {
  const t = useTranslations();

  return (
    <Modal isDismissable isOpen={isOpen} onOpenChange={onOpenChange}>
      <Dialog className="flex flex-col items-center gap-6 p-12 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-functional-greenWhite">
          <LuCircleCheck className="size-10 text-functional-green" />
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="font-serif text-title-lg text-neutral-black">
            {t('Results are live!')}
          </h2>
          <p className="max-w-sm text-base text-neutral-charcoal">
            {t(
              'All participants have been notified and can now view the winning proposals.',
            )}
          </p>
        </div>
        <Button
          color="primary"
          className="w-full"
          onPress={() => onOpenChange(false)}
        >
          {t('View public results page')}
        </Button>
      </Dialog>
    </Modal>
  );
};
