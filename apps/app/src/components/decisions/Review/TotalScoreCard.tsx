import type { RubricTemplateSchema } from '@op/common/client';
import { Surface } from '@op/ui/Surface';

import { useTranslations } from '@/lib/i18n';

import { getCriteria } from '../rubricTemplate';

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
