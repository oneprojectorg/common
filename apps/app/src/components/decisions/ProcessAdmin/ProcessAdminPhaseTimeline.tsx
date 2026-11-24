'use client';

import type { DecisionPhase } from '@op/api/encoders';
import { PhaseCard, type PhaseCardState } from '@op/sense/PhaseCard';
import { useLocale } from 'next-intl';

import { Link, useTranslations } from '@/lib/i18n';

import {
  type PhaseTemplates,
  getSetupBlurbKey,
  isPhaseReady,
} from './phaseSetup';

export function ProcessAdminPhaseTimeline({
  slug,
  phases,
  currentStateId,
  hasStarted,
  templates,
  isEditing = false,
}: {
  slug: string;
  phases: DecisionPhase[];
  /** Where a phase without its own form falls back to the decision's. */
  templates: PhaseTemplates;
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
  const rows = phases.map((phase, index) => {
    const state = getPhaseState({ index, currentIndex, hasStarted });
    return {
      phase,
      state,
      needsSetup: state !== 'current' && !isPhaseReady(phase, templates),
    };
  });
  const leadIndex = rows.findIndex((row) => row.needsSetup);

  return (
    <ol className="flex flex-col gap-4">
      {rows.map(({ phase, state, needsSetup }, index) => {
        const name = phase.name ?? '';
        const hasEditLink = phase.slug !== null && (isEditing || needsSetup);

        return (
          <li key={phase.id ?? `unstored-${index}`}>
            <PhaseCard
              state={state}
              name={name}
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
              editLink={
                hasEditLink ? (
                  <Link
                    href={`/decisions/${slug}/manage/phase/${phase.slug}`}
                  />
                ) : undefined
              }
              needsSetup={needsSetup}
              isLead={index === leadIndex}
              setupLabel={t('processAdmin.setupAction')}
              setupAriaLabel={t('processAdmin.setupPhaseLabel', {
                phaseName: name,
              })}
              blurb={t(`processAdmin.${getSetupBlurbKey(phase)}`)}
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
