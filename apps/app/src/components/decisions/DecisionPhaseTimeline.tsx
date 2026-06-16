'use client';

import { type ProcessPhase } from '@op/api/encoders';
import { type Phase } from '@op/ui/PhaseStepper';
import { PhaseTimeline } from '@op/ui/PhaseTimeline';
import { useLocale } from 'next-intl';
import { useMemo } from 'react';

import { useRouter, useTranslations } from '@/lib/i18n';

import { useDecisionTranslation } from './DecisionTranslationContext';
import { useAdvancePhase } from './useAdvancePhase';

/**
 * Vertical phase timeline for the decision Overview sidebar. App-side wrapper
 * around the presentational @op/ui PhaseTimeline (cf. DecisionProcessStepper →
 * PhaseStepper): resolves translated phase names, derives the "Now open!" and
 * admin-advanceable phases, wires the arrow to the current-phase view, and
 * reuses useAdvancePhase for the advance flow.
 */
export function DecisionPhaseTimeline({
  phases,
  currentStateId,
  instanceId,
  isAdmin,
  decisionSlug,
  className,
}: {
  phases: ProcessPhase[];
  currentStateId: string;
  instanceId?: string;
  isAdmin?: boolean;
  decisionSlug: string;
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations();
  const router = useRouter();
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
    currentPhaseEndDate,
    nowOpenPhaseId,
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
      currentPhaseEndDate: currentPhase?.phase?.endDate,
      nowOpenPhaseId: currentPhase?.config?.allowProposals
        ? currentPhase.id
        : undefined,
    };
  }, [phases, currentStateId, translatedPhaseNames]);

  const { requestAdvance, advanceConfirm } = useAdvancePhase({
    instanceId,
    currentStateId,
    nextPhaseId,
    currentPhaseName,
    nextPhaseName,
    currentPhaseEndDate,
  });

  const transformedPhases: Phase[] = useMemo(
    () =>
      phases.map((phase) => ({
        id: phase.id,
        name: translatedPhaseNames?.get(phase.id) ?? phase.name,
        description: phase.description,
        startDate: phase.phase?.startDate,
        endDate: phase.phase?.endDate,
      })),
    [phases, translatedPhaseNames],
  );

  return (
    <>
      <PhaseTimeline
        phases={transformedPhases}
        currentPhaseId={currentStateId}
        className={className}
        locale={locale}
        nowOpenPhaseId={nowOpenPhaseId}
        nowOpenLabel={t('Now open!')}
        advanceablePhaseId={isAdmin ? nextPhaseId : undefined}
        advanceLabel={t('Advance')}
        onAdvance={isAdmin ? requestAdvance : undefined}
        onNavigate={() => router.push(`/decisions/${decisionSlug}/current`)}
        navigateAriaLabel={t('Go to the current phase')}
      />
      {advanceConfirm}
    </>
  );
}
