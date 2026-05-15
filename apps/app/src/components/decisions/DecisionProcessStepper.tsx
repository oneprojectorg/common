'use client';

import { trpc } from '@op/api/client';
import { type ProcessPhase } from '@op/api/encoders';
import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Button } from '@op/ui-next/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui-next/Modal';
import { type Phase, PhaseStepper } from '@op/ui/PhaseStepper';
import { Sheet, SheetBody } from '@op/ui/Sheet';
import { toast } from '@op/ui/Toast';
import { useLocale } from 'next-intl';
import { usePostHog } from 'posthog-js/react';
import { useCallback, useMemo, useRef, useState } from 'react';

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
  const translation = useDecisionTranslation();
  const translatedPhaseNames = useMemo(
    () =>
      translation
        ? new Map(translation.phases.map((p) => [p.id, p.name]))
        : null,
    [translation],
  );

  const posthog = usePostHog();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const transitionInitiatedRef = useRef(false);
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
    currentPhaseEndDate,
  } = useMemo(() => {
    const idx = phases.findIndex((p) => p.id === currentStateId);
    const currentPhase = idx >= 0 ? phases[idx] : undefined;
    const nextPhase = idx >= 0 ? phases[idx + 1] : undefined;
    return {
      nextPhaseId: nextPhase?.id,
      currentPhaseName: currentPhase
        ? (translatedPhaseNames?.get(currentPhase.id) ?? currentPhase.name)
        : '',
      nextPhaseName: nextPhase
        ? (translatedPhaseNames?.get(nextPhase.id) ?? nextPhase.name)
        : '',
      currentPhaseAdvancement: currentPhase?.advancementMethod,
      currentPhaseEndDate: currentPhase?.phase?.endDate,
    };
  }, [phases, currentStateId, translatedPhaseNames]);

  const transformedPhases: Phase[] = useMemo(
    () =>
      phases.map((phase) => {
        const isNextActionable = isAdmin && phase.id === nextPhaseId;
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
      isAdmin,
      nextPhaseId,
      currentPhaseAdvancement,
      t,
    ],
  );

  const getTrackingProps = useCallback(
    () => ({
      process_instance_id: instanceId,
      from_phase_id: currentStateId,
      to_phase_id: nextPhaseId,
      before_end_date: currentPhaseEndDate
        ? isBeforeEndOfDayLocal(new Date(), currentPhaseEndDate)
        : null,
    }),
    [instanceId, currentStateId, nextPhaseId, currentPhaseEndDate],
  );

  const handleAdvancePhase = () => {
    if (!instanceId || transitionMutation.isPending) {
      return;
    }
    transitionInitiatedRef.current = true;
    transitionMutation.mutate({
      instanceId,
      fromPhaseId: currentStateId,
    });
  };

  const handleDismiss = (open: boolean) => {
    if (!open && !transitionMutation.isPending) {
      if (!transitionInitiatedRef.current) {
        posthog.capture('manual_transition_dismissed', getTrackingProps());
      }
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
          isAdmin
            ? () => {
                transitionInitiatedRef.current = false;
                posthog.capture(
                  'manual_transition_initiated',
                  getTrackingProps(),
                );
                setShowConfirmModal(true);
              }
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
            <p className="text-sm text-neutral-charcoal">{body}</p>
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
            <p className="text-sm text-neutral-charcoal">{body}</p>
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

// Phase end dates are persisted as ISO datetimes representing local midnight on
// the deadline day (see PhaseDetailPage formatDateValue). The deadline conceptually
// covers the entire day, so "before end date" must compare against the end of the
// stored day in local time, not its midnight start.
function isBeforeEndOfDayLocal(now: Date, endDate: string): boolean {
  const parsed = new Date(endDate);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  const endOfDayLocal = new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate() + 1,
    0,
    0,
    0,
    0,
  );
  return now < endOfDayLocal;
}
