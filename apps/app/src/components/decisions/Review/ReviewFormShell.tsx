import type { RubricReviewData, RubricTemplateSchema } from '@op/common/client';
import { getRubricScoringInfo } from '@op/common/client';
import { Card } from '@op/sense/Card';
import { Header3 } from '@op/sense/Header';
import type { ReactNode } from 'react';

import { TranslatedText } from '@/components/TranslatedText';

import { getCriteria } from '../rubricTemplate';

export function FormShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <Header3>
        <TranslatedText text="Review Proposal" />
      </Header3>
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
  const scoringInfo = getRubricScoringInfo(rubricTemplate);
  const { totalPoints } = scoringInfo;

  // A rubric with no scored criteria (all qualitative) has no total to show.
  if (!scoringInfo.criteria.some((criterion) => criterion.scored)) {
    return null;
  }

  const totalScore = criteria.reduce<number | null>((total, criterion) => {
    const value = values[criterion.id];

    if (typeof value !== 'number') {
      return total;
    }

    return (total ?? 0) + value;
  }, null);

  const scoreText = totalScore === null ? '–' : String(totalScore);
  const display = totalPoints > 0 ? `${scoreText}/${totalPoints}` : '–';

  return (
    // The one filled row in the panel: a 16/450 label against a 20px figure.
    <Card className="flex-row items-center justify-between bg-muted p-4">
      <span className="text-base font-strong">
        <TranslatedText text="Total score:" />
      </span>
      <span className="font-serif text-title">{display}</span>
    </Card>
  );
}
