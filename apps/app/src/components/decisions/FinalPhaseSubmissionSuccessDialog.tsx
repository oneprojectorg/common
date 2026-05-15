'use client';

import { Button } from '@op/ui/Button';
import { CheckIcon } from '@op/ui/CheckIcon';
import { Modal } from '@op/ui/Modal';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

export const QUERY_PARAM = 'resultsLive';

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
  // Local dismissal flips synchronously so pressing the button closes the
  // modal immediately — router.replace is async and useSearchParams may not
  // re-read in time to flip isOpen on the next render.
  const [isDismissed, setIsDismissed] = useState(false);
  const isOpen = !isDismissed && searchParams.get(QUERY_PARAM) === '1';

  const handleClose = () => {
    setIsDismissed(true);
    const params = new URLSearchParams(window.location.search);
    params.delete(QUERY_PARAM);
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    router.replace(next);
  };

  return (
    <Modal
      isDismissable
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
      confetti
      className="flex flex-col items-center gap-6 p-12 text-center"
    >
      <CheckIcon />
      <div className="flex flex-col gap-3">
        <h2 className="font-serif text-title-lg text-neutral-black">
          {t('Results are live!')}
        </h2>
        <p className="max-w-sm text-base text-neutral-charcoal">
          {t('All participants can now view the winning proposals.')}
        </p>
      </div>
      <Button color="primary" className="w-full" onPress={handleClose}>
        {t('View public results page')}
      </Button>
    </Modal>
  );
};
