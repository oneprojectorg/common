'use client';

import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@op/sense/Dialog';
import { CheckIcon } from '@op/sense/icons';
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
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      {/* 32rem keeps the width the @op/ui Modal had before the swap. */}
      <DialogContent
        confetti
        className="flex flex-col items-center gap-6 p-12 text-center sm:max-w-lg"
      >
        <CheckIcon />
        <div className="flex flex-col gap-3">
          <DialogTitle className="text-headline text-foreground">
            {t('Results are live!')}
          </DialogTitle>
          <DialogDescription className="max-w-sm text-base">
            {t('All participants can now view the winning proposals.')}
          </DialogDescription>
        </div>
        <Button className="w-full" onClick={handleClose}>
          {t('View public results page')}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
