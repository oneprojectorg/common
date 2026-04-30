import type { RubricReviewData, RubricTemplateSchema } from '@op/common/client';
import { Header3 } from '@op/ui/Header';
import { Surface } from '@op/ui/Surface';
import type { ReactNode } from 'react';

import { TranslatedText } from '@/components/TranslatedText';

import { getCriteria } from '../rubricTemplate';

export function FormShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-border pb-4">
        <Header3 className="font-serif font-light">
          <TranslatedText text="Review Proposal" />
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
  values: RubricReviewData['answers'];
}) {
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
      className="flex items-start justify-between rounded-lg border-border p-4"
    >
      <span className="text-base text-foreground">
        <TranslatedText text="Total Score" />
      </span>
      <span className="text-base text-foreground">
        {totalScore === null ? '–' : totalScore}
      </span>
    </Surface>
  );
}
