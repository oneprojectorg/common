import {
  type ProposalReview,
  type RubricTemplateSchema,
  isOverallRecommendationField,
  parseSchemaOptions,
} from '@op/common/client';
import { Surface } from '@op/ui/Surface';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import { FieldHeader } from '../forms/FieldHeader';
import { compileRubricSchema } from '../forms/rubric';
import type { FieldDescriptor } from '../forms/types';
import { getCriteria, inferCriterionType } from '../rubricTemplate';

export function SubmittedReviewView({
  rubricTemplate,
  review,
}: {
  rubricTemplate: RubricTemplateSchema;
  review: ProposalReview;
}) {
  const t = useTranslations();
  const fields = compileRubricSchema(rubricTemplate);
  const { answers, rationales } = review.reviewData;

  return (
    <div className="flex flex-col gap-6">
      {fields.map((field) => (
        <ResultSection
          key={field.key}
          title={field.schema.title}
          description={field.schema.description}
        >
          <RubricFieldResult
            field={field}
            value={answers[field.key]}
            rationale={rationales[field.key]?.trim() || undefined}
          />
        </ResultSection>
      ))}

      {review.overallComment && (
        <ResultSection title={t('Feedback to Author')}>
          <ResultCard description={review.overallComment} />
        </ResultSection>
      )}
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

function ResultSection({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 border-b border-neutral-gray1 pb-6">
      <FieldHeader title={title} description={description} />
      {children}
    </section>
  );
}

function ResultCard({
  value,
  description,
}: {
  value?: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-neutral-gray1 p-6">
      {value !== undefined && value !== null && value !== '' && (
        <div className="font-serif text-title-base font-light text-neutral-black">
          {value}
        </div>
      )}
      {description && (
        <div className="min-w-0 flex-1 text-sm text-neutral-gray4">
          {description}
        </div>
      )}
    </div>
  );
}

function RubricFieldResult({
  field,
  value,
  rationale,
}: {
  field: FieldDescriptor;
  value: unknown;
  rationale?: string;
}) {
  const t = useTranslations();

  if (field.format === 'dropdown') {
    if (inferCriterionType(field.schema) === 'yes_no') {
      const label =
        value === 'yes' ? t('Yes') : value === 'no' ? t('No') : undefined;
      return <ResultCard value={label} description={rationale} />;
    }

    const options = parseSchemaOptions(field.schema);
    const selected = options.find(
      (option) => String(option.value) === String(value),
    );

    if (isOverallRecommendationField(field.key)) {
      return (
        <ResultCard
          value={selected?.title ?? selected?.value}
          description={rationale}
        />
      );
    }

    return (
      <ResultCard
        value={selected?.value}
        description={selected?.title || rationale}
      />
    );
  }

  if (field.format === 'long-text' || field.format === 'short-text') {
    const text = typeof value === 'string' ? value.trim() : '';
    return <ResultCard description={text || '—'} />;
  }

  return null;
}
