'use client';

import { trpc } from '@op/api/client';
import { type ProcessPhase } from '@op/api/encoders';
import { type Phase, PhaseStepper } from '@op/ui/PhaseStepper';
import { toast } from '@op/ui/Toast';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

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

  const transitionMutation = trpc.decision.manualTransition.useMutation({
    onSuccess: () => {
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

  // Transform ProcessPhase to Phase format for PhaseStepper
  const transformedPhases: Phase[] = phases.map((phase) => ({
    id: phase.id,
    name: translatedPhaseNames?.get(phase.id) ?? phase.name,
    description: phase.description,
    startDate: phase.phase?.startDate,
    endDate: phase.phase?.endDate,
    sortOrder: phase.phase?.sortOrder,
    interactive: isAdmin && phase.id === nextPhaseId,
    ariaLabel:
      isAdmin && phase.id === nextPhaseId
        ? t('Start {phaseName}', {
            phaseName: translatedPhaseNames?.get(phase.id) ?? phase.name,
          })
        : undefined,
  }));

  const handleTransition = () => {
    if (!instanceId || transitionMutation.isPending) {
      return;
    }
    transitionMutation.mutate({
      instanceId,
      fromPhaseId: currentStateId,
    });
  };

  return (
    <PhaseStepper
      phases={transformedPhases}
      currentPhaseId={currentStateId}
      className={className}
      locale={locale}
      onTransition={isAdmin ? handleTransition : undefined}
    />
  );
}
