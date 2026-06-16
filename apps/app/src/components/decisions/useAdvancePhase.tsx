'use client';

import { trpc } from '@op/api/client';
import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Sheet, SheetBody } from '@op/ui/Sheet';
import { toast } from '@op/ui/Toast';
import { usePostHog } from 'posthog-js/react';
import { type ReactNode, useCallback, useRef, useState } from 'react';

import { useRouter, useTranslations } from '@/lib/i18n';

interface UseAdvancePhaseArgs {
  instanceId?: string;
  /** Phase the process is currently in (the one being advanced out of). */
  currentStateId: string;
  /** Phase the process advances into. Undefined when there is no next phase. */
  nextPhaseId?: string;
  /** Translated names used in the confirmation copy. */
  currentPhaseName: string;
  nextPhaseName: string;
  /** Current phase end date, for the "advanced before deadline" tracking flag. */
  currentPhaseEndDate?: string;
}

interface UseAdvancePhaseResult {
  /** Open the confirmation dialog (and record the PostHog "initiated" event). */
  requestAdvance: () => void;
  /** The confirmation Modal/Sheet to render somewhere in the tree. */
  advanceConfirm: ReactNode;
  isAdvancing: boolean;
}

/**
 * Owns the "advance to the next phase" flow shared by the phase stepper and the
 * overview phase timeline: the `transitionFromPhase` mutation, the
 * confirm Modal (desktop) / Sheet (mobile), PostHog tracking, and the toast +
 * refresh on success. Consumers render `advanceConfirm` and call
 * `requestAdvance` from whatever affordance triggers the advance.
 */
export function useAdvancePhase({
  instanceId,
  currentStateId,
  nextPhaseId,
  currentPhaseName,
  nextPhaseName,
  currentPhaseEndDate,
}: UseAdvancePhaseArgs): UseAdvancePhaseResult {
  const t = useTranslations();
  const router = useRouter();
  const posthog = usePostHog();
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const transitionInitiatedRef = useRef(false);

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

  const requestAdvance = useCallback(() => {
    transitionInitiatedRef.current = false;
    posthog.capture('manual_transition_initiated', getTrackingProps());
    setShowConfirmModal(true);
  }, [posthog, getTrackingProps]);

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

  const advanceConfirm = isMobile ? (
    <Sheet
      isOpen={showConfirmModal}
      onOpenChange={handleDismiss}
      isDismissable={!transitionMutation.isPending}
      side="bottom"
    >
      <SheetBody className="flex flex-col gap-4 p-4 text-start">
        <div className="font-serif text-title-sm">
          <bdi>{title}</bdi>
        </div>
        <p dir="auto" className="text-sm text-neutral-charcoal">
          {body}
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
      </SheetBody>
    </Sheet>
  ) : (
    <Modal
      isOpen={showConfirmModal}
      onOpenChange={handleDismiss}
      isDismissable={false}
      surface="flat"
    >
      <ModalHeader className="px-6 pb-6 text-start">
        <bdi>{title}</bdi>
      </ModalHeader>
      <ModalBody className="px-6 py-6">
        <p dir="auto" className="text-sm text-neutral-charcoal">
          {body}
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
  );

  return {
    requestAdvance,
    advanceConfirm,
    isAdvancing: transitionMutation.isPending,
  };
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
