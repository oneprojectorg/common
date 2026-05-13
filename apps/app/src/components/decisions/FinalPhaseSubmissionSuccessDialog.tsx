'use client';

import { Button } from '@op/ui/Button';
import { Dialog } from '@op/ui/Dialog';
import { Modal } from '@op/ui/Modal';
import { useRouter, useSearchParams } from 'next/navigation';
import { LuCircleCheck } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

const QUERY_PARAM = 'resultsLive';

/**
 * One-shot celebration shown to the submitting admin after final-phase
 * confirmation (Figma 2310-11489). Mounted on ResultsPage; opens when the
 * URL carries `?resultsLive=1` and strips the param on dismiss so refreshes
 * don't re-open it.
 */
export const FinalPhaseSubmissionSuccessDialog = () => {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isOpen = searchParams.get(QUERY_PARAM) === '1';

  const handleOpenChange = (open: boolean) => {
    if (open || !isOpen) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    params.delete(QUERY_PARAM);
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    router.replace(next);
  };

  return (
    <Modal isDismissable isOpen={isOpen} onOpenChange={handleOpenChange} confetti>
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
          onPress={() => handleOpenChange(false)}
        >
          {t('View public results page')}
        </Button>
      </Dialog>
    </Modal>
  );
};
