'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { trpc } from '@op/api/client';
import { type ProcessPhase } from '@op/api/encoders';
import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { type Phase, PhaseStepper } from '@op/ui/PhaseStepper';
import { Sheet, SheetBody } from '@op/ui/Sheet';
import { toast } from '@op/ui/Toast';
import { useLocale } from 'next-intl';
import { useMemo, useState } from 'react';

import { useRouter, useTranslations } from '@/lib/i18n';

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
  const manualTransitionsEnabled = useFeatureFlag('manual_transitions');
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

  const transitionMutation = trpc.decision.transitionFromPhase.useMutation({
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

  const {
    nextPhaseId,
    currentPhaseName,
    nextPhaseName,
    currentPhaseAdvancement,
  } = useMemo(() => {
    const idx = phases.findIndex((p) => p.id === currentStateId);
    const nextId =
      idx >= 0 && idx < phases.length - 1 ? phases[idx + 1]!.id : undefined;
    return {
      nextPhaseId: nextId,
      currentPhaseName:
        idx >= 0
          ? (translatedPhaseNames?.get(phases[idx]!.id) ?? phases[idx]!.name)
          : '',
      nextPhaseName: nextId
        ? (translatedPhaseNames?.get(nextId) ?? phases[idx + 1]!.name)
        : '',
      currentPhaseAdvancement:
        idx >= 0 ? phases[idx]!.advancementMethod : undefined,
    };
  }, [phases, currentStateId, translatedPhaseNames]);

  const transformedPhases: Phase[] = useMemo(
    () =>
      phases.map((phase) => {
        const isNextActionable =
          manualTransitionsEnabled && isAdmin && phase.id === nextPhaseId;
        return {
          id: phase.id,
          name: translatedPhaseNames?.get(phase.id) ?? phase.name,
          description: phase.description,
          startDate: phase.phase?.startDate,
          endDate: phase.phase?.endDate,
          interactive: isNextActionable,
          showOnHoverOnly: isNextActionable
            ? currentPhaseAdvancement !== 'manual'
            : undefined,
          ariaLabel: isNextActionable
            ? t('Start {phaseName}', {
                phaseName: translatedPhaseNames?.get(phase.id) ?? phase.name,
              })
            : undefined,
        };
      }),
    [
      phases,
      translatedPhaseNames,
      manualTransitionsEnabled,
      isAdmin,
      nextPhaseId,
      currentPhaseAdvancement,
      t,
    ],
  );

  const handleAdvancePhase = () => {
    if (!instanceId || transitionMutation.isPending) {
      return;
    }
    transitionMutation.mutate({
      instanceId,
      fromPhaseId: currentStateId,
    });
  };

  const handleDismiss = (open: boolean) => {
    if (!open && !transitionMutation.isPending) {
      setShowConfirmModal(false);
    }
  };

  const title = t('Advance to {phaseName}?', { phaseName: nextPhaseName });
  const body = t(
    'This will end the {currentPhase} phase and move to {nextPhase}.',
    { currentPhase: currentPhaseName, nextPhase: nextPhaseName },
  );

  return (
    <>
      <PhaseStepper
        phases={transformedPhases}
        currentPhaseId={currentStateId}
        className={className}
        locale={locale}
        onTransition={
          manualTransitionsEnabled && isAdmin
            ? () => setShowConfirmModal(true)
            : undefined
        }
      />

      {isMobile ? (
        <Sheet
          isOpen={showConfirmModal}
          onOpenChange={handleDismiss}
          isDismissable={!transitionMutation.isPending}
          side="bottom"
        >
          <SheetBody className="flex flex-col gap-4 p-4 text-left">
            <div className="font-serif text-title-sm">{title}</div>
            <p className="text-sm text-foreground">{body}</p>
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
          </SheetBody>
        </Sheet>
      ) : (
        <Modal
          isOpen={showConfirmModal}
          onOpenChange={handleDismiss}
          isDismissable={false}
          surface="flat"
        >
          <ModalHeader className="px-6 pb-6 text-left">{title}</ModalHeader>
          <ModalBody className="px-6 py-6">
            <p className="text-sm text-foreground">{body}</p>
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
