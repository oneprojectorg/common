'use client';

import {
  type RubricTemplateSchema,
  type XFormatPropertySchema,
  parseSchemaOptions,
} from '@op/common/client';
import { Button } from '@op/ui/Button';
import { Header3, Header4 } from '@op/ui/Header';
import { Select, SelectItem } from '@op/ui/Select';
import { Surface } from '@op/ui/Surface';
import { TextField } from '@op/ui/TextField';
import { ToggleButton } from '@op/ui/ToggleButton';
import type { Key } from 'react';
import { useState } from 'react';
import { LuPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { FieldHeader } from '../forms/FieldHeader';
import { compileRubricSchema } from '../forms/rubric';
import type { FieldDescriptor } from '../forms/types';
import {
  getCriteria,
  getCriterionMaxPoints,
  inferCriterionType,
} from '../rubricTemplate';

interface ReviewRubricFormProps {
  template: RubricTemplateSchema;
}

/**
 * Local-only schema-driven review rubric form renderer.
 */
export function ReviewRubricForm({ template }: ReviewRubricFormProps) {
  const t = useTranslations();
  const fields = compileRubricSchema(template);
  const criteria = getCriteria(template);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [feedbackToAuthor, setFeedbackToAuthor] = useState('');
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  const handleValueChange = (key: string, value: unknown) => {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const totalScore = criteria.reduce<number | null>((total, criterion) => {
    const value = values[criterion.id];

    if (typeof value !== 'number') {
      return total;
    }

    return (total ?? 0) + value;
  }, null);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="border-b border-neutral-gray1 pb-4">
        <Header3 className="font-serif !text-title-base font-light">
          {t('Review Proposal')}
        </Header3>
      </div>

      {fields.map((field) => (
        <RubricCriterionSection
          key={field.key}
          field={field}
          maxPoints={getCriterionMaxPoints(template, field.key) ?? 0}
          value={values[field.key]}
          onChange={(value) => handleValueChange(field.key, value)}
        />
      ))}

      {isFeedbackOpen ? (
        <section className="flex flex-col gap-3 border-b border-neutral-gray1 pb-6">
          <div className="flex flex-col gap-1">
            <Header4>{t('Feedback to Author')}</Header4>
            <p className="text-sm text-midGray">
              {t(
                'Feedback will be shared with the author after the review phase ends',
              )}
            </p>
          </div>

          <TextField
            aria-label={t('Feedback to Author')}
            value={feedbackToAuthor}
            onChange={setFeedbackToAuthor}
            useTextArea
            textareaProps={{ rows: 3 }}
          />
        </section>
      ) : (
        <Button
          color="secondary"
          size="medium"
          className="w-full"
          onPress={() => setIsFeedbackOpen(true)}
        >
          <LuPlus className="size-4" />
          {t('Feedback to author')}
        </Button>
      )}

      <Surface
        variant="filled"
        className="flex items-start justify-between border-neutral-gray1 p-4"
      >
        <span className="text-base text-neutral-charcoal">
          {t('Total Score')}
        </span>
        <span className="text-base text-neutral-black">
          {totalScore === null ? '–' : totalScore}
        </span>
      </Surface>
    </div>
  );
}

/**
 * Render one rubric criterion using plain `@op/ui` inputs.
 */
function RubricCriterionSection({
  field,
  maxPoints,
  value,
  onChange,
}: {
  field: FieldDescriptor;
  maxPoints: number;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const t = useTranslations();
  const criterionType = inferCriterionType(field.schema);
  const scoreLabel = maxPoints > 0 ? `${maxPoints} ${t('pts')}` : null;
  const badgeLabel = criterionType === 'yes_no' ? t('No/Yes') : scoreLabel;

  return (
    <section className="flex flex-col gap-4 border-b border-neutral-gray1 pb-6">
      {criterionType === 'yes_no' ? (
        <>
          <FieldHeader
            title={field.schema.title}
            badge={badgeLabel}
            className="gap-1"
          />

          <div className="flex items-center gap-3">
            {field.schema.description && (
              <p className="flex-1 text-sm text-neutral-charcoal">
                {field.schema.description}
              </p>
            )}

            <RubricFieldInput field={field} value={value} onChange={onChange} />
          </div>
        </>
      ) : (
        <>
          <FieldHeader
            title={field.schema.title}
            description={field.schema.description}
            badge={badgeLabel}
            className="gap-1"
          />

          <RubricFieldInput field={field} value={value} onChange={onChange} />
        </>
      )}
    </section>
  );
}

/**
 * Render the input control for a rubric field.
 */
function RubricFieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDescriptor;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const t = useTranslations();

  switch (field.format) {
    case 'dropdown': {
      if (inferCriterionType(field.schema) === 'yes_no') {
        return (
          <ToggleButton
            size="small"
            isSelected={value === 'yes'}
            onChange={(isSelected) => {
              onChange(isSelected ? 'yes' : 'no');
            }}
          />
        );
      }

      const options = parseSchemaOptions(field.schema).map((option) => ({
        value: option.value,
        label: option.title,
      }));
      const selectedKey =
        typeof value === 'string' || typeof value === 'number'
          ? String(value)
          : null;

      return (
        <Select
          aria-label={field.schema.title}
          placeholder={t('Select option')}
          selectedKey={selectedKey}
          onSelectionChange={(key) => {
            onChange(parseSelectedValue(key, field.schema));
          }}
          className="w-full"
        >
          {options.map((option) => (
            <SelectItem key={String(option.value)} id={String(option.value)}>
              {option.label}
            </SelectItem>
          ))}
        </Select>
      );
    }

    case 'long-text':
      return (
        <TextField
          aria-label={field.schema.title}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          useTextArea
          textareaProps={{ placeholder: t('Start typing...'), rows: 3 }}
        />
      );

    case 'short-text':
      return (
        <TextField
          aria-label={field.schema.title}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          inputProps={{ placeholder: t('Start typing...') }}
        />
      );

    default:
      return null;
  }
}

/**
 * Convert a select key back into the schema's expected primitive type.
 */
function parseSelectedValue(
  key: Key | null,
  schema: XFormatPropertySchema,
): string | number | null {
  if (key === null) {
    return null;
  }

  const value = String(key);

  if (schema.type === 'integer') {
    return Number(value);
  }

  return value;
}
