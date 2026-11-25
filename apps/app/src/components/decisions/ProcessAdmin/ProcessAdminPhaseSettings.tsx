'use client';

import { formatDate, formatDateRange } from '@/utils/formatting';
import type { DecisionPhase } from '@op/api/encoders';
import { Card, CardContent, CardHeader, CardTitle } from '@op/sense/Card';
import { cn } from '@op/sense/lib/utils';
import { useLocale } from 'next-intl';
import type { ReactNode } from 'react';
import { LuCalendar, LuCalendarClock } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { AdminPhaseKind } from './phaseKind';

export function PhaseWindowCard({
  phase,
  kind,
  previousPhase,
}: {
  phase: DecisionPhase;
  kind: AdminPhaseKind;
  previousPhase: DecisionPhase | undefined;
}) {
  const locale = useLocale();
  const t = useTranslations('decisions.processAdmin');
  const dates =
    kind === 'Results'
      ? formatDateRange(phase.startDate ?? phase.endDate, undefined, locale)
      : formatDateRange(phase.startDate, phase.endDate, locale);

  return (
    <SettingsCard title={t(`phaseWindow${kind}`)}>
      <p
        className={cn(
          'flex items-center gap-2',
          !dates && 'text-muted-foreground',
        )}
      >
        <LuCalendar className="size-4 shrink-0" aria-hidden />
        {dates || t('phaseDatesNotSet')}
      </p>
      {previousPhase ? (
        <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
          <LuCalendarClock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {previousPhase.endDate
              ? t.rich('previousPhaseEnds', {
                  phaseName: previousPhase.name ?? previousPhase.phaseId,
                  date: formatDate(previousPhase.endDate, locale, {
                    month: 'short',
                    day: 'numeric',
                  }),
                  name: (chunks) => <bdi>{chunks}</bdi>,
                })
              : t.rich('previousPhaseNoEndDate', {
                  phaseName: previousPhase.name ?? previousPhase.phaseId,
                  name: (chunks) => <bdi>{chunks}</bdi>,
                })}
          </span>
        </p>
      ) : null}
    </SettingsCard>
  );
}

function SettingsCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-label">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">{children}</CardContent>
    </Card>
  );
}
