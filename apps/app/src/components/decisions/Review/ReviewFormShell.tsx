import type { RubricTemplateSchema } from '@op/common/client';
import { Header3 } from '@op/ui/Header';
import { Surface } from '@op/ui/Surface';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import { getCriteria } from '../rubricTemplate';

export function FormShell({ children }: { children: ReactNode }) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-neutral-gray1 pb-4">
        <Header3 className="font-serif !text-title-base font-light">
          {t('Review Proposal')}
        </Header3>
      </div>
      {children}
    </div>
  );
}

export function TotalScoreCard({
  rubricTemplate,
  values,
}: {
  rubricTemplate: RubricTemplateSchema;
  values: Record<string, unknown>;
}) {
  const t = useTranslations();
  const criteria = getCriteria(rubricTemplate);

  const totalScore = criteria.reduce<number | null>((total, criterion) => {
    const value = values[criterion.id];

    if (typeof value !== 'number') {
      return total;
    }

    return (total ?? 0) + value;
  }, null);

  return (
    <Surface
      variant="filled"
      className="flex items-start justify-between rounded-lg border-neutral-gray1 p-4"
    >
      <span className="text-base text-neutral-charcoal">
        {t('Total Score')}
      </span>
      <span className="text-base text-neutral-black">
        {totalScore === null ? '–' : totalScore}
      </span>
    </Surface>
  );
}
