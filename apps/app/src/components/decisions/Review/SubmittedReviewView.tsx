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
import { Separator } from '@op/sense/Separator';
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

/** One answer in a `ResultCard`: the value, with its explanation below it. */
interface ResultCardRow {
  /** Stable key — an option id, or `value` for a single-answer card. */
  id: string;
  value?: ReactNode;
  description?: ReactNode;
}

/**
 * The answer, with the reviewer's note below a rule. Bordered, not filled —
 * the total score is the only filled row in this panel.
 */
function ResultCard({
  value,
  description,
  rationale,
  rows,
}: {
  value?: ReactNode;
  description?: ReactNode;
  rationale?: ReactNode;
  /**
   * Several answers stacked in one card — a multi-select, where every selected
   * option is a row of its own. Takes the place of `value`/`description`.
   */
  rows?: ResultCardRow[];
}) {
  const topRows = (rows ?? [{ id: 'value', value, description }]).filter(
    (row) => hasRowContent(row),
  );
  const hasRationale = !!rationale;
  const hasTopRow = topRows.length > 0;

  return (
    <div className="mt-1 flex flex-col gap-3 rounded-lg border p-6">
      {hasTopRow && (
        <div className="flex flex-col gap-3">
          {topRows.map((row) => (
            <ResultCardTopRow
              key={row.id}
              value={row.value}
              description={row.description}
            />
          ))}
        </div>
      )}
      {hasRationale && hasTopRow && <Separator />}
      {hasRationale && (
        <div className="text-base text-muted-foreground">{rationale}</div>
      )}
    </div>
  );
}

/**
 * The value, with its explanation stacked below it — vertical on the designer's
 * direct direction, which supersedes the side-by-side "Answer" frame in Figma.
 * Don't restore the horizontal row from that frame without asking them again.
 *
 * The explanation goes through `FieldDescription` (muted, `text-sm`) because
 * `text-label` puts the value at 1rem, the same size as body copy: stacked
 * same-size text in one colour reads as one paragraph, so the hierarchy has to
 * come from colour and size on the description instead.
 */
function ResultCardTopRow({ value, description }: Omit<ResultCardRow, 'id'>) {
  return (
    <div className="flex flex-col gap-1">
      {hasRowValue(value) && (
        <span className="font-serif text-label">{value}</span>
      )}
      {description ? (
        // Authored copy, so its line breaks are meant.
        <FieldDescription className="whitespace-pre-wrap">
          {description}
        </FieldDescription>
      ) : null}
    </div>
  );
}

function hasRowValue(value: ReactNode): boolean {
  return value !== undefined && value !== null && value !== '';
}

function hasRowContent(row: ResultCardRow): boolean {
  return hasRowValue(row.value) || !!row.description;
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
    const amount = getMoneyAmount(value);
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

    // Multi-select stores an array of opaque option ids. Each selected option
    // gets the same row a single-select answer gets — title, then its own
    // explanation beside it — stacked inside the one card.
    if (inferCriterionType(field.schema) === 'multi_select') {
      const selectedRows = getSelectedOptionValues(value).map((id) => {
        const option = findSchemaOption(field.schema, id);
        return {
          id,
          value: option?.title || id,
          description: option?.description,
        };
      });

      return (
        <ResultCard
          rows={
            selectedRows.length > 0
              ? selectedRows
              : [{ id: 'unanswered', value: '—' }]
          }
          rationale={rationale}
        />
      );
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
