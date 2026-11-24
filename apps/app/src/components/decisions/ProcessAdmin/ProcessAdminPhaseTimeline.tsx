'use client';

import type { DecisionPhase } from '@op/api/encoders';
import { PhaseCard, type PhaseCardState } from '@op/sense/PhaseCard';
import { useLocale } from 'next-intl';

import { useTranslations } from '@/lib/i18n';

export function ProcessAdminPhaseTimeline({
  slug,
  phases,
  currentStateId,
  hasStarted,
  isEditing = false,
}: {
  slug: string;
  phases: DecisionPhase[];
  currentStateId: string | null | undefined;
  /** Before the first phase starts, every phase shows as upcoming. */
  hasStarted: boolean;
  isEditing?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations('decisions');
  const currentIndex = phases.findIndex(
    (phase) => phase.phaseId === currentStateId,
  );

  return (
    <ol className="flex flex-col gap-6">
      {phases.map((phase, index) => {
        const state = getPhaseState({ index, currentIndex, hasStarted });

        return (
          <li key={phase.id ?? `unstored-${index}`}>
            <PhaseCard
              state={state}
              name={phase.name ?? ''}
              startDate={phase.startDate}
              endDate={phase.endDate}
              locale={locale}
              isNowOpen={
                state === 'current' && phase.rules?.proposals?.submit === true
              }
              nowOpenLabel={t('phaseNowOpen')}
              href={
                state === 'current' ? `/decisions/${slug}/current` : undefined
              }
              editLink={isEditing ? <a href="#" /> : undefined}
            />
          </li>
        );
      })}
    </ol>
  );
}

function getPhaseState({
  index,
  currentIndex,
  hasStarted,
}: {
  index: number;
  currentIndex: number;
  hasStarted: boolean;
}): PhaseCardState {
  if (!hasStarted || currentIndex < 0 || index > currentIndex) {
    return 'upcoming';
  }

  return index < currentIndex ? 'completed' : 'current';
}
