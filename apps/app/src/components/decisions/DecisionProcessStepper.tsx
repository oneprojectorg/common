'use client';

import { trpc } from '@op/api/client';
import { type ProcessPhase } from '@op/api/encoders';
import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { type Phase, PhaseStepper } from '@op/ui/PhaseStepper';
import { toast } from '@op/ui/Toast';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useDecisionTranslation } from './DecisionTranslationContext';

export function DecisionProcessStepper({
  phases,
  currentStateId,
  instanceId,
  isAdmin,
  className = '',
}: {
  phases: ProcessPhase[];
  currentStateId: string;
  instanceId?: string;
  isAdmin?: boolean;
  className?: string;
}) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations();
  const translation = useDecisionTranslation();
  const translatedPhaseNames = useMemo(
    () =>
      translation
        ? new Map(translation.phases.map((p) => [p.id, p.name]))
        : null,
    [translation],
  );

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`);

  const transitionMutation = trpc.decision.manualTransition.useMutation({
    onSuccess: () => {
      setShowConfirmModal(false);
      toast.success({ message: t('Phase advanced successfully') });
      router.refresh();
    },
    onError: (error) => {
      toast.error({
        message: error.message || t('Failed to advance phase'),
      });
    },
  });

  // Find the next phase after the current one (the phase we'd transition into)
  const sortedByOrder = useMemo(
    () =>
      [...phases].sort(
        (a, b) => (a.phase?.sortOrder ?? 0) - (b.phase?.sortOrder ?? 0),
      ),
    [phases],
  );
  const currentIndex = sortedByOrder.findIndex((p) => p.id === currentStateId);
  const nextPhaseId =
    currentIndex >= 0 && currentIndex < sortedByOrder.length - 1
      ? sortedByOrder[currentIndex + 1]!.id
      : undefined;

  const currentPhaseName =
    currentIndex >= 0
      ? (translatedPhaseNames?.get(sortedByOrder[currentIndex]!.id) ??
        sortedByOrder[currentIndex]!.name)
      : '';
  const nextPhaseName = nextPhaseId
    ? (translatedPhaseNames?.get(nextPhaseId) ??
      sortedByOrder[currentIndex + 1]!.name)
    : '';

  // The current phase's advancement method determines play button visibility:
  // 'manual' = always visible, 'date' = only on hover (admin override)
  const currentPhaseAdvancement =
    currentIndex >= 0
      ? sortedByOrder[currentIndex]!.advancementMethod
      : undefined;

  // Transform ProcessPhase to Phase format for PhaseStepper
  const transformedPhases: Phase[] = phases.map((phase) => ({
    id: phase.id,
    name: translatedPhaseNames?.get(phase.id) ?? phase.name,
    description: phase.description,
    startDate: phase.phase?.startDate,
    endDate: phase.phase?.endDate,
    sortOrder: phase.phase?.sortOrder,
    interactive: isAdmin && phase.id === nextPhaseId,
    showOnHoverOnly:
      isAdmin && phase.id === nextPhaseId
        ? currentPhaseAdvancement !== 'manual'
        : undefined,
    ariaLabel:
      isAdmin && phase.id === nextPhaseId
        ? t('Start {phaseName}', {
            phaseName: translatedPhaseNames?.get(phase.id) ?? phase.name,
          })
        : undefined,
  }));

  const handleAdvancePhase = () => {
    if (!instanceId || transitionMutation.isPending) {
      return;
    }
    transitionMutation.mutate({
      instanceId,
      fromPhaseId: currentStateId,
    });
  };

  return (
    <>
      <PhaseStepper
        phases={transformedPhases}
        currentPhaseId={currentStateId}
        className={className}
        locale={locale}
        onTransition={isAdmin ? () => setShowConfirmModal(true) : undefined}
      />

      {isMobile ? (
        <Modal
          isOpen={showConfirmModal}
          onOpenChange={(open) => {
            if (!open && !transitionMutation.isPending) {
              setShowConfirmModal(false);
            }
          }}
          isDismissable={!transitionMutation.isPending}
          overlayClassName="p-0 items-end justify-center"
          className="m-0 h-auto w-screen max-w-none rounded-t-lg rounded-b-none border-0 outline-0"
        >
          <div className="flex flex-col gap-4 p-4">
            <div className="font-serif text-title-sm">
              {t('Advance to {phaseName}?', { phaseName: nextPhaseName })}
            </div>
            <p className="text-sm text-neutral-charcoal">
              {t(
                'This will end the {currentPhase} phase and move to {nextPhase}.',
                {
                  currentPhase: currentPhaseName,
                  nextPhase: nextPhaseName,
                },
              )}
            </p>
            <div className="flex flex-col gap-4">
              <Button
                color="primary"
                isLoading={transitionMutation.isPending}
                onPress={handleAdvancePhase}
                className="w-full"
              >
                {t('Advance Phase')}
              </Button>
              <Button
                color="secondary"
                isDisabled={transitionMutation.isPending}
                onPress={() => setShowConfirmModal(false)}
                className="w-full"
              >
                {t('Cancel')}
              </Button>
            </div>
          </div>
        </Modal>
      ) : (
        <Modal
          isOpen={showConfirmModal}
          onOpenChange={(open) => {
            if (!open && !transitionMutation.isPending) {
              setShowConfirmModal(false);
            }
          }}
          isDismissable={!transitionMutation.isPending}
          surface="flat"
        >
          <ModalHeader className="px-6 pt-6 text-left">
            {t('Advance to {phaseName}?', { phaseName: nextPhaseName })}
          </ModalHeader>
          <ModalBody className="px-6 py-6">
            <p className="text-sm text-neutral-charcoal">
              {t(
                'This will end the {currentPhase} phase and move to {nextPhase}.',
                {
                  currentPhase: currentPhaseName,
                  nextPhase: nextPhaseName,
                },
              )}
            </p>
          </ModalBody>
          <ModalFooter className="px-6 py-6">
            <Button
              color="secondary"
              isDisabled={transitionMutation.isPending}
              onPress={() => setShowConfirmModal(false)}
            >
              {t('Cancel')}
            </Button>
            <Button
              color="primary"
              isLoading={transitionMutation.isPending}
              onPress={handleAdvancePhase}
            >
              {t('Advance Phase')}
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}
