import {
  type ProposalReview,
  type RubricTemplateSchema,
  findSchemaOption,
  getMoneyAmount,
  isOverallRecommendationField,
  resolveMoneyDisplayCurrency,
} from '@op/common/client';
import { Field, FieldDescription, FieldTitle } from '@op/sense/Field';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import {
  ReviewResultCard,
  ReviewResultNote,
  ReviewResultOption,
  ReviewResultText,
} from '@op/sense/ReviewResultCard';
import { useFormatter } from 'next-intl';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import { compileRubricSchema } from '../forms/rubric';
import type { FieldDescriptor } from '../forms/types';
import {
  YES_NO_VALUES,
  getSelectedOptionValues,
  inferCriterionType,
} from '../rubricTemplate';

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
          <ReviewResultCard className="mt-1">
            <ReviewResultText>{review.overallComment}</ReviewResultText>
          </ReviewResultCard>
        </ResultSection>
      )}
    </div>
  );
}

/** Stands in for an answer the reviewer left blank. */
const EMPTY_ANSWER = '—';

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

  const note = rationale ? (
    <ReviewResultNote>{rationale}</ReviewResultNote>
  ) : null;

  if (inferCriterionType(field.schema) === 'money') {
    const amount = getMoneyAmount(value);

    return (
      <ReviewResultCard className="mt-1">
        <ReviewResultOption
          title={
            amount === null
              ? EMPTY_ANSWER
              : format.number(amount, {
                  style: 'currency',
                  currency: resolveMoneyDisplayCurrency(value, field.schema),
                })
          }
        />
        {note}
      </ReviewResultCard>
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

      return (
        <ReviewResultCard className="mt-1">
          {label ? <ReviewResultOption title={label} /> : null}
          {note}
        </ReviewResultCard>
      );
    }

    // Multi-select stores an array of opaque option ids. Each selected option
    // gets the same row a single-select answer gets — title, then its own
    // explanation below it — stacked inside the one card.
    if (inferCriterionType(field.schema) === 'multi_select') {
      const selectedIds = getSelectedOptionValues(value);

      return (
        <ReviewResultCard className="mt-1">
          {selectedIds.length > 0 ? (
            selectedIds.map((id) => {
              const option = findSchemaOption(field.schema, id);

              return (
                <ReviewResultOption
                  key={id}
                  title={option?.title || id}
                  description={option?.description}
                />
              );
            })
          ) : (
            <ReviewResultOption title={EMPTY_ANSWER} />
          )}
          {note}
        </ReviewResultCard>
      );
    }

    const selected = findSchemaOption(field.schema, value);

    if (isOverallRecommendationField(field.key)) {
      const label = selected
        ? (selected.title ?? String(selected.value))
        : null;

      return (
        <ReviewResultCard className="mt-1">
          {label ? <ReviewResultOption title={label} /> : null}
          {note}
        </ReviewResultCard>
      );
    }

    // Single-select options store an opaque id as the value, so show the
    // option's title instead.
    if (inferCriterionType(field.schema) === 'single_select') {
      return (
        <ReviewResultCard className="mt-1">
          <ReviewResultOption
            title={
              selected ? selected.title || String(selected.value) : EMPTY_ANSWER
            }
            description={selected?.description}
          />
          {note}
        </ReviewResultCard>
      );
    }

    // Scored: the number is the answer, the scale label explains it.
    return (
      <ReviewResultCard className="mt-1">
        {selected ? (
          <ReviewResultOption
            title={String(selected.value)}
            description={selected.title}
          />
        ) : null}
        {note}
      </ReviewResultCard>
    );
  }

  if (field.format === 'long-text' || field.format === 'short-text') {
    const text = typeof value === 'string' ? value.trim() : '';

    return (
      <ReviewResultCard className="mt-1">
        <ReviewResultText>{text || EMPTY_ANSWER}</ReviewResultText>
        {note}
      </ReviewResultCard>
    );
  }

  return null;
}
