'use client';

import { trpc } from '@op/api/client';
import { useMediaQuery } from '@op/hooks';
import { toast } from '@op/sense/Toast';
import { screens } from '@op/styles/constants';
import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Sheet, SheetBody } from '@op/ui/Sheet';
import { useRef } from 'react';

import { useRouter, useTranslations } from '@/lib/i18n';

interface AdvancePhaseConfirmProps {
  instanceId?: string;
  /** Phase the process is currently in (the one being advanced out of). */
  currentPhaseId: string;
  /** Translated names used in the confirmation copy. */
  currentPhaseName: string;
  nextPhaseName: string;
  isOpen: boolean;
  onClose: () => void;
  /** Called when the dialog closes without the advance being initiated. */
  onDismissWithoutAdvance: () => void;
}

/**
 * Confirmation Modal (desktop) / Sheet (mobile) for the admin "advance to the
 * next phase" flow: owns the `transitionFromPhase` mutation and the toast +
 * refresh on success. Loaded lazily by useAdvancePhase on the first advance
 * request, so this chunk (Modal/Sheet/Toast machinery) never ships to the
 * non-admin viewers who make up nearly all decision-page traffic.
 */
export function AdvancePhaseConfirm({
  instanceId,
  currentPhaseId,
  currentPhaseName,
  nextPhaseName,
  isOpen,
  onClose,
  onDismissWithoutAdvance,
}: AdvancePhaseConfirmProps) {
  const t = useTranslations();
  const router = useRouter();
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`);

  const advanceInitiatedRef = useRef(false);

  const transitionMutation = trpc.decision.transitionFromPhase.useMutation({
    onSuccess: () => {
      advanceInitiatedRef.current = false;
      onClose();
      toast.success(t('Phase advanced successfully'));
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message || t('Failed to advance phase'));
    },
  });

  const handleAdvancePhase = () => {
    if (!instanceId || transitionMutation.isPending) {
      return;
    }
    advanceInitiatedRef.current = true;
    transitionMutation.mutate({
      instanceId,
      fromPhaseId: currentPhaseId,
    });
  };

  // Every close path resets the ref so the next open starts a fresh "was the
  // advance initiated?" cycle — the component stays mounted between opens.
  const closeAndReset = () => {
    advanceInitiatedRef.current = false;
    onClose();
  };

  const handleDismiss = (open: boolean) => {
    if (!open && !transitionMutation.isPending) {
      if (!advanceInitiatedRef.current) {
        onDismissWithoutAdvance();
      }
      closeAndReset();
    }
  };

  const title = t('Advance to {phaseName}?', { phaseName: nextPhaseName });
  const body = t(
    'This will end the {currentPhase} phase and move to {nextPhase}.',
    { currentPhase: currentPhaseName, nextPhase: nextPhaseName },
  );

  return isMobile ? (
    <Sheet
      isOpen={isOpen}
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
            onPress={closeAndReset}
            className="w-full"
          >
            {t('Cancel')}
          </Button>
        </div>
      </SheetBody>
    </Sheet>
  ) : (
    <Modal
      isOpen={isOpen}
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
          onPress={onClose}
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
}
