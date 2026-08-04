'use client';

import { type ProcessPhase } from '@op/api/encoders';
import { type Phase, PhaseStepper } from '@op/sense/PhaseStepper';
import { useLocale } from 'next-intl';
import { useMemo } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useDecisionTranslation } from './DecisionTranslationContext';
import { useAdvancePhase } from './useAdvancePhase';

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
  const t = useTranslations();
  const translation = useDecisionTranslation();
  const translatedPhaseNames = useMemo(
    () =>
      translation
        ? new Map(translation.phases.map((p) => [p.id, p.name]))
        : null,
    [translation],
  );

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

  const { requestAdvance, advanceConfirm } = useAdvancePhase({
    instanceId,
    currentPhaseId: currentStateId,
    nextPhaseId,
    currentPhaseName,
    nextPhaseName,
    currentPhaseEndDate,
  });

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

  return (
    <>
      <PhaseStepper
        phases={transformedPhases}
        currentPhaseId={currentStateId}
        className={className}
        locale={locale}
        onTransition={isAdmin ? requestAdvance : undefined}
      />
      {advanceConfirm}
    </>
  );
}
