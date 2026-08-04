'use client';

import { trpc } from '@op/api/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@op/sense/AlertDialog';
import { Spinner } from '@op/sense/Spinner';
import { toast } from '@op/sense/Toast';
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
 * Confirmation AlertDialog for the admin "advance to the next phase" flow: owns
 * the `transitionFromPhase` mutation and the toast + refresh on success. Loaded
 * lazily by useAdvancePhase on the first advance request, so this chunk never
 * ships to the non-admin viewers who make up nearly all decision-page traffic.
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
  const handleOpenChange = (open: boolean) => {
    if (open || transitionMutation.isPending) {
      return;
    }
    if (!advanceInitiatedRef.current) {
      onDismissWithoutAdvance();
    }
    advanceInitiatedRef.current = false;
    onClose();
  };

  const title = t('Advance to {phaseName}?', { phaseName: nextPhaseName });
  const body = t(
    'This will end the {currentPhase} phase and move to {nextPhase}.',
    { currentPhase: currentPhaseName, nextPhase: nextPhaseName },
  );

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            <bdi>{title}</bdi>
          </AlertDialogTitle>
          <AlertDialogDescription dir="auto">{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={transitionMutation.isPending}>
            {t('Cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleAdvancePhase}
            disabled={transitionMutation.isPending}
          >
            {transitionMutation.isPending ? <Spinner /> : null}
            {t('Advance Phase')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
