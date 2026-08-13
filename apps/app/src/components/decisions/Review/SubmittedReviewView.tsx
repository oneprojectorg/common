import {
  type ProposalReview,
  type RubricTemplateSchema,
  type TemplateSectionBlock,
  findSchemaOption,
  groupFieldsBySection,
  isOverallRecommendationField,
} from '@op/common/client';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import { FieldHeader } from '../forms/FieldHeader';
import { compileRubricSchema } from '../forms/rubric';
import type { FieldDescriptor } from '../forms/types';
import { inferCriterionType } from '../rubricTemplate';
import { RubricSectionShell } from './RubricSection';

export function SubmittedReviewView({
  rubricTemplate,
  review,
}: {
  rubricTemplate: RubricTemplateSchema;
  review: ProposalReview;
}) {
  const t = useTranslations();
  const fields = compileRubricSchema(rubricTemplate);
  const blocks = groupFieldsBySection(rubricTemplate, fields);
  const { answers, rationales } = review.reviewData;

  const renderField = (field: FieldDescriptor) => (
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
  );

  return (
    <div className="flex flex-col gap-6">
      {blocks.map((block) => (
        <ResultBlock
          key={blockKey(block)}
          block={block}
          renderField={renderField}
        />
      ))}

      {review.overallComment && (
        <ResultSection title={t('Feedback to Author')}>
          <ResultCard description={review.overallComment} />
        </ResultSection>
      )}
    </div>
  );
}

/**
 * One grouping block of a submitted review: a bare criterion result, or a
 * section wrapper with its members.
 */
function ResultBlock({
  block,
  renderField,
}: {
  block: TemplateSectionBlock<FieldDescriptor>;
  renderField: (field: FieldDescriptor) => ReactNode;
}) {
  if (block.kind === 'field') {
    return renderField(block.field);
  }

  return (
    <RubricSectionShell section={block.section}>
      {block.fields.map(renderField)}
    </RubricSectionShell>
  );
}

/**
 * Keyed on a field key rather than the section id: a legacy template with a
 * split section yields one block per run, so the section id alone is not unique.
 */
function blockKey(block: TemplateSectionBlock<FieldDescriptor>): string {
  return block.kind === 'field'
    ? `field:${block.field.key}`
    : `section:${block.section.id}:${block.fields[0]?.key ?? ''}`;
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
    <section className="flex flex-col gap-4 border-b border-neutral-gray1 pb-6">
      <FieldHeader
        title={title}
        description={description}
        required={required}
      />
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

    const selected = findSchemaOption(field.schema, value);

    if (isOverallRecommendationField(field.key)) {
      return (
        <ResultCard
          value={selected?.title ?? selected?.value}
          description={rationale}
        />
      );
    }

    // Single-select options store an opaque id as the value, so show the
    // option's title instead.
    if (inferCriterionType(field.schema) === 'single_select') {
      return (
        <ResultCard
          value={selected ? selected.title || String(selected.value) : '—'}
          description={selected?.description || rationale}
          rationale={selected?.description ? rationale : undefined}
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
