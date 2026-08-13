import {
  type ProposalReview,
  type RubricTemplateSchema,
  findSchemaOption,
  getMoneyAnswerAmount,
  isOverallRecommendationField,
  resolveMoneyDisplayCurrency,
} from '@op/common/client';
import { Field, FieldDescription, FieldTitle } from '@op/sense/Field';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import { Separator } from '@op/sense/Separator';
import { useFormatter } from 'next-intl';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import { compileRubricSchema } from '../forms/rubric';
import type { FieldDescriptor } from '../forms/types';
import { YES_NO_VALUES, inferCriterionType } from '../rubricTemplate';

/**
 * A submitted review, read-only: each criterion's prompt above a bordered card
 * holding the answer and the reviewer's note.
 *
 * Field chrome matches `ReviewRubricForm` so the panel doesn't change shape on
 * submit. Rendered for the reviewer's own review, a peer's, and the admin
 * drill-in; only the first passes a total score, hence `scoreSlot`.
 */
export function SubmittedReviewView({
  rubricTemplate,
  review,
  scoreSlot,
}: {
  rubricTemplate: RubricTemplateSchema;
  review: ProposalReview;
  /**
   * Between the criteria and the feedback block, per the design.
   */
  scoreSlot?: ReactNode;
}) {
  const t = useTranslations();
  const fields = compileRubricSchema(rubricTemplate);
  const { answers, rationales } = review.reviewData;

  return (
    <div className="flex flex-col gap-8">
      {fields.map((field) => (
        <ResultSection
          key={field.key}
          title={field.schema.title}
          description={field.schema.description}
          required={field.required}
        >
          <RubricFieldResult
            field={field}
            value={answers[field.key]}
            rationale={rationales[field.key]?.trim() || undefined}
          />
        </ResultSection>
      ))}

      {scoreSlot}

      {review.overallComment && (
        <ResultSection
          title={t('Feedback to Author')}
          description={t(
            'Shared anonymously with the author after the review phase',
          )}
        >
          <ResultCard description={review.overallComment} />
        </ResultSection>
      )}
    </div>
  );
}

function ResultSection({
  title,
  description,
  required,
  children,
}: {
  title?: string;
  description?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    // Authored content: one direction for the block, so the title and its
    // description can't resolve differently and disagree.
    <Field dir="auto">
      {/* `h4`, as in the editable form — a long review is navigated by heading. */}
      {title ? (
        <FieldTitle render={<h4 />}>
          {title}
          {required ? <RequiredAsterisk /> : null}
        </FieldTitle>
      ) : null}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {children}
    </Field>
  );
}

/**
 * The answer, with the reviewer's note below a rule. Bordered, not filled —
 * the total score is the only filled row in this panel.
 */
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
    <div className="mt-1 flex flex-col gap-3 rounded-lg border p-6">
      {hasTopRow && (
        <div className="flex items-start gap-4">
          {hasValue && <span className="font-serif text-title">{value}</span>}
          {hasDescription && (
            <div className="mt-0.75 min-w-0 flex-1 text-base whitespace-pre-wrap">
              {description}
            </div>
          )}
        </div>
      )}
      {hasRationale && hasTopRow && <Separator />}
      {hasRationale && (
        <div className="text-base text-muted-foreground">{rationale}</div>
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
  const format = useFormatter();

  if (inferCriterionType(field.schema) === 'money') {
    const amount = getMoneyAnswerAmount(value);
    return (
      <ResultCard
        value={
          amount === null
            ? '—'
            : format.number(amount, {
                style: 'currency',
                currency: resolveMoneyDisplayCurrency(value, field.schema),
              })
        }
        rationale={rationale}
      />
    );
  }

  if (field.format === 'dropdown') {
    if (inferCriterionType(field.schema) === 'yes_no') {
      const label =
        value === YES_NO_VALUES.yes
          ? t('Yes')
          : value === YES_NO_VALUES.no
            ? t('No')
            : undefined;
      return <ResultCard value={label} rationale={rationale} />;
    }

    const selected = findSchemaOption(field.schema, value);

    if (isOverallRecommendationField(field.key)) {
      return (
        <ResultCard
          value={selected?.title ?? selected?.value}
          rationale={rationale}
        />
      );
    }

    // Single-select options store an opaque id as the value, so show the
    // option's title instead.
    if (inferCriterionType(field.schema) === 'single_select') {
      return (
        <ResultCard
          value={selected ? selected.title || String(selected.value) : '—'}
          description={selected?.description}
          rationale={rationale}
        />
      );
    }

    return (
      <ResultCard
        value={selected?.value}
        description={selected?.title}
        rationale={rationale}
      />
    );
  }

  if (field.format === 'long-text' || field.format === 'short-text') {
    const text = typeof value === 'string' ? value.trim() : '';
    return <ResultCard description={text || '—'} />;
  }

  return null;
}
