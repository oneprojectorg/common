'use client';

import { type ProcessPhase } from '@op/api/encoders';
import { PhaseCard, type PhaseCardState } from '@op/sense/PhaseCard';
import { cn } from '@op/sense/lib/utils';
import { useLocale } from 'next-intl';
import { useMemo } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useDecisionTranslation } from './DecisionTranslationContext';
import { useAdvancePhase } from './useAdvancePhase';

/**
 * Vertical phase timeline for the decision Overview sidebar. App-side
 * composition over the presentational PhaseCard (cf. DecisionProcessStepper
 * → PhaseStepper): owns the <ol> and the completed/current/upcoming derivation,
 * resolves translated phase names, flags the "Now open!" and admin-advanceable
 * phases, links the current card to its phase view, and reuses useAdvancePhase
 * for the advance flow.
 */
export function DecisionPhaseTimeline({
  phases,
  currentPhaseId,
  hasStarted = true,
  instanceId,
  isAdmin,
  decisionSlug,
  className,
}: {
  phases: ProcessPhase[];
  /**
   * The instance's actual current phase. Always pass it, even before the process
   * begins — the advance flow derives the next phase from it. Use `hasStarted` to
   * control whether a phase is *presented* as current.
   */
  currentPhaseId: string;
  /**
   * Whether the first phase has started. When false no phase is presented as
   * current or completed (the process hasn't visibly begun), but an admin can
   * still advance: the next phase keeps its advanceable treatment, which is an
   * upcoming variant anyway.
   */
  hasStarted?: boolean;
  instanceId?: string;
  isAdmin?: boolean;
  decisionSlug: string;
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

  const phaseName = (phase: ProcessPhase) =>
    translatedPhaseNames?.get(phase.id) ?? phase.name;

  const currentIndex = phases.findIndex((p) => p.id === currentPhaseId);
  const currentPhase = currentIndex >= 0 ? phases[currentIndex] : undefined;
  const nextPhase = currentIndex >= 0 ? phases[currentIndex + 1] : undefined;
  const nextPhaseId = nextPhase?.id;

  const { requestAdvance, advanceConfirm } = useAdvancePhase({
    instanceId,
    currentPhaseId,
    nextPhaseId,
    currentPhaseName: currentPhase ? phaseName(currentPhase) : '',
    nextPhaseName: nextPhase ? phaseName(nextPhase) : '',
    currentPhaseEndDate: currentPhase?.phase?.endDate,
  });

  const currentHref = `/decisions/${decisionSlug}/current`;

  return (
    <>
      <ol className={cn('flex flex-col gap-6', className)}>
        {phases.map((phase, index) => {
          const state: PhaseCardState = !hasStarted
            ? 'upcoming'
            : index < currentIndex
              ? 'completed'
              : index === currentIndex
                ? 'current'
                : 'upcoming';
          const isAdvanceable = isAdmin === true && phase.id === nextPhaseId;

          return (
            <PhaseCard
              key={phase.id}
              state={state}
              name={phaseName(phase)}
              startDate={phase.phase?.startDate}
              endDate={phase.phase?.endDate}
              locale={locale}
              isNowOpen={
                state === 'current' && phase.config?.allowProposals === true
              }
              nowOpenLabel={t('Now open!')}
              isAdvanceable={isAdvanceable}
              advanceLabel={t('Advance')}
              onAdvance={isAdvanceable ? requestAdvance : undefined}
              href={state === 'current' ? currentHref : undefined}
            />
          );
        })}
      </ol>
      {advanceConfirm}
    </>
  );
}
