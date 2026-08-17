'use client';

import { trpc } from '@op/api/client';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@op/sense/Dialog';
import { Header3 } from '@op/sense/Header';
import { Skeleton } from '@op/sense/Skeleton';
import { CheckIcon } from '@op/sense/icons';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '../ErrorBoundary';
import { formatStepForDisplay, getNextSteps } from './utils/processSteps';

interface VoteSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  instanceId: string;
}

const VoteSuccessModalSuspense = ({
  isOpen,
  onClose,
  instanceId,
}: VoteSuccessModalProps) => {
  const t = useTranslations();

  const [processInstance] = trpc.decision.getInstance.useSuspenseQuery({
    instanceId,
  });

  const phases = processInstance.instanceData?.phases ?? [];

  const nextSteps = getNextSteps(phases, processInstance.currentStateId);

  const processTitle = processInstance.name;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* 32rem — the sense default (sm:max-w-sm) is narrower than this needs. */}
      <DialogContent confetti className="justify-center sm:max-w-lg">
        <div className="z-10 p-12 text-center">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-4">
              <div className="flex size-16 flex-col items-center justify-center gap-4">
                <CheckIcon />
              </div>

              <div className="flex flex-col gap-2">
                <DialogTitle className="font-serif text-2xl font-light">
                  {t('Your ballot is in!')}
                </DialogTitle>

                <DialogDescription className="text-base">
                  {processTitle
                    ? t(
                        'Thank you for participating in {title}. Your voice helps shape how we invest in our community.',
                        {
                          title: processTitle,
                        },
                      )
                    : t(
                        'Thank you for participating in the 2025 Community Vote. Your voice helps shape how we invest in our community.',
                      )}
                </DialogDescription>
              </div>

              {nextSteps.length > 0 && (
                <div className="flex w-full flex-col gap-6 text-start text-base">
                  <Header3 className="font-sans">
                    {t("Here's what will happen next:")}
                  </Header3>
                  <ul className="flex flex-col gap-4 ps-4">
                    {nextSteps.map((step) => (
                      <li key={step.id} className="flex items-start gap-2">
                        <span aria-hidden>•</span>
                        <span>{formatStepForDisplay(step)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Button onClick={onClose} className="w-full">
              {t('View all proposals')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const VoteSuccessModal = (props: VoteSuccessModalProps) => (
  <ErrorBoundary>
    <Suspense fallback={<Skeleton />}>
      <VoteSuccessModalSuspense {...props} />
    </Suspense>
  </ErrorBoundary>
);
