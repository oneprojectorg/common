import {
  type ProposalReview,
  type RubricAnswerValue,
  type RubricTemplateSchema,
  isOverallRecommendationField,
  parseRubricReviewData,
  parseSchemaOptions,
} from '@op/common/client';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import { FieldHeader } from '../forms/FieldHeader';
import { compileRubricSchema } from '../forms/rubric';
import type { FieldDescriptor } from '../forms/types';
import { inferCriterionType } from '../rubricTemplate';

export function SubmittedReviewView({
  rubricTemplate,
  review,
}: {
  rubricTemplate: RubricTemplateSchema;
  review: ProposalReview;
}) {
  const t = useTranslations();
  const fields = compileRubricSchema(rubricTemplate);
  const { answers, rationales } = parseRubricReviewData(
    rubricTemplate,
    review.reviewData,
  );

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
  rationale,
}: {
  value?: ReactNode;
  description?: ReactNode;
  rationale?: ReactNode;
}) {
  const hasValue = value !== undefined && value !== null && value !== '';
  const hasDescription = !!description;
  const hasRationale = !!rationale;
  const hasTopRow = hasValue || hasDescription;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-neutral-gray1 p-6">
      {hasTopRow && (
        <div className="flex items-center gap-4">
          {hasValue && (
            <span className="font-serif !text-title-base text-neutral-black">
              {value}
            </span>
          )}
          {hasDescription && (
            <div className="min-w-0 flex-1 text-sm text-neutral-gray4">
              {description}
            </div>
          )}
        </div>
      )}
      {hasRationale && hasTopRow && (
        <div className="h-px w-full bg-neutral-gray1" />
      )}
      {hasRationale && (
        <div className="text-base text-neutral-charcoal">{rationale}</div>
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
  value: RubricAnswerValue | undefined;
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
        rationale={selected?.title ? rationale : undefined}
      />
    );
  }

  if (field.format === 'long-text' || field.format === 'short-text') {
    const text = typeof value === 'string' ? value.trim() : '';
    return <ResultCard description={text || '—'} />;
  }

  return null;
}
