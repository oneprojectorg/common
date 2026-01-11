'use client';

import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { CheckIcon } from '@op/ui/CheckIcon';
import { DialogTrigger } from '@op/ui/Dialog';
import { Header1, Header3 } from '@op/ui/Header';
import { Modal } from '@op/ui/Modal';
import { Skeleton } from '@op/ui/Skeleton';
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

  const nextSteps =
    processInstance?.process?.processSchema?.states &&
    processInstance?.instanceData
      ? getNextSteps(
          processInstance.process.processSchema.states,
          processInstance.instanceData,
        )
      : [];

  const processTitle = processInstance?.name;

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal isDismissable>
        <div className="z-10 p-12 text-center">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-4">
              <div className="flex size-16 flex-col items-center justify-center gap-4">
                <CheckIcon />
              </div>

              <div className="flex flex-col gap-2">
                <Header1 className="font-serif text-2xl font-light">
                  {t('Your ballot is in!')}
                </Header1>

                <p className="text-neutral-charcoal text-base">
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
                </p>
              </div>

              {nextSteps.length > 0 && (
                <div className="text-neutral-charcoal flex w-full flex-col gap-6 text-left text-base">
                  <Header3>{t("Here's what will happen next:")}</Header3>
                  <ul className="flex flex-col gap-4 pl-4">
                    {nextSteps.map((step) => (
                      <li key={step.id} className="flex items-start gap-2">
                        <span>•</span>
                        <span>{formatStepForDisplay(step)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Button onPress={onClose} color="primary" className="w-full">
              {t('View all proposals')}
            </Button>
          </div>
        </div>
      </Modal>
    </DialogTrigger>
  );
};

export const VoteSuccessModal = (props: VoteSuccessModalProps) => (
  <ErrorBoundary>
    <Suspense fallback={<Skeleton />}>
      <VoteSuccessModalSuspense {...props} />
    </Suspense>
  </ErrorBoundary>
);
