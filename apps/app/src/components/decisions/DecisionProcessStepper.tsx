'use client';

import { trpc } from '@op/api/client';
import { type ProcessPhase } from '@op/api/encoders';
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

      <Modal
        isOpen={showConfirmModal}
        onOpenChange={(open) => {
          if (!open && !transitionMutation.isPending) {
            setShowConfirmModal(false);
          }
        }}
        surface="flat"
      >
        <ModalHeader className="pl-6 text-left">
          {t('Advance to {phaseName}?', { phaseName: nextPhaseName })}
        </ModalHeader>
        <ModalBody>
          <p className="text-neutral-charcoal">
            {t(
              'This will end the {currentPhase} phase and move to {nextPhase}.',
              {
                currentPhase: currentPhaseName,
                nextPhase: nextPhaseName,
              },
            )}
          </p>
        </ModalBody>
        <ModalFooter>
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
    </>
  );
}
