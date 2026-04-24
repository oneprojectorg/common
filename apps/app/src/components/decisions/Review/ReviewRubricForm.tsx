'use client';

import {
  type XFormatPropertySchema,
  isOverallRecommendationField,
  parseSchemaOptions,
} from '@op/common/client';
import { AlertBanner } from '@op/ui/AlertBanner';
import { Button } from '@op/ui/Button';
import { Header3 } from '@op/ui/Header';
import { Radio, RadioGroup } from '@op/ui/RadioGroup';
import { Select, SelectItem } from '@op/ui/Select';
import { Surface } from '@op/ui/Surface';
import { TextField } from '@op/ui/TextField';
import { ToggleButton } from '@op/ui/ToggleButton';
import type { Key } from 'react';
import { useState } from 'react';
import { LuCircleAlert, LuPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { FieldHeader } from '../forms/FieldHeader';
import { compileRubricSchema } from '../forms/rubric';
import type { FieldDescriptor } from '../forms/types';
import {
  getCriteria,
  getCriterionMaxPoints,
  inferCriterionType,
} from '../rubricTemplate';
import { useReviewForm } from './ReviewFormContext';
import { ViewRevisionRequestModal } from './ViewRevisionRequestModal';

/**
 * Schema-driven review rubric form renderer.
 */
export function ReviewRubricForm() {
  const t = useTranslations();
  const {
    rubricTemplate: template,
    values,
    rationales,
    overallComment,
    handleValueChange,
    handleRationaleChange,
    handleOverallCommentChange,
    isPausedForRevision,
  } = useReviewForm();
  const fields = compileRubricSchema(template);
  const criteria = getCriteria(template);

  const [isFeedbackOpen, setIsFeedbackOpen] = useState(
    overallComment.length > 0,
  );
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const totalScore = criteria.reduce<number | null>((total, criterion) => {
    const value = values[criterion.id];

    if (typeof value !== 'number') {
      return total;
    }

    return (total ?? 0) + value;
  }, null);

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-neutral-gray1 pb-4">
        <Header3 className="font-serif !text-title-base font-light">
          {t('Review Proposal')}
        </Header3>
      </div>

      {isPausedForRevision && (
        <>
          <AlertBanner
            intent="warning"
            variant="banner"
            icon={<LuCircleAlert className="size-4" />}
          >
            <span>
              <strong>{t('Proposal Revision Requested')}</strong>
              <br />
              {t('Reviewing is paused until author submits a revision.')}{' '}
              <button
                type="button"
                className="underline"
                onClick={() => setIsViewModalOpen(true)}
              >
                {t('View feedback')}
              </button>
            </span>
          </AlertBanner>

          <ViewRevisionRequestModal
            isOpen={isViewModalOpen}
            onOpenChange={setIsViewModalOpen}
          />
        </>
      )}

      <div
        className={
          isPausedForRevision ? 'pointer-events-none opacity-50' : undefined
        }
      >
        <div className="flex flex-col gap-6">
          {fields.map((field) => (
            <RubricCriterionSection
              key={field.key}
              field={field}
              maxPoints={getCriterionMaxPoints(template, field.key) ?? 0}
              value={values[field.key]}
              onChange={(value) => handleValueChange(field.key, value)}
              rationaleValue={rationales[field.key] ?? ''}
              onRationaleChange={(value) =>
                handleRationaleChange(field.key, value)
              }
              rationalePlaceholder={
                isOverallRecommendationField(field.key)
                  ? t('Add overall notes...')
                  : t('Add reasons or insights...')
              }
            />
          ))}

          {isFeedbackOpen ? (
            <section className="flex flex-col gap-3 border-b border-neutral-gray1 pb-6">
              <FieldHeader
                title={t('Feedback to Author')}
                description={t(
                  'Feedback will be shared with the author after the review phase ends',
                )}
                className="gap-1"
              />

              <TextField
                aria-label={t('Feedback to Author')}
                value={overallComment}
                onChange={handleOverallCommentChange}
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
              {t('Feedback to Author')}
            </Button>
          )}

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
        </div>
      </div>
    </div>
  );
}

/**
 * Render one rubric criterion with an always-on rationale textarea below.
 */
function RubricCriterionSection({
  field,
  maxPoints,
  value,
  onChange,
  rationaleValue,
  onRationaleChange,
  rationalePlaceholder,
}: {
  field: FieldDescriptor;
  maxPoints: number;
  value: unknown;
  onChange: (value: unknown) => void;
  rationaleValue: string;
  onRationaleChange: (value: string) => void;
  rationalePlaceholder: string;
}) {
  const t = useTranslations();
  const criterionType = inferCriterionType(field.schema);
  const scoreLabel = maxPoints > 0 ? `${maxPoints} ${t('pts')}` : null;
  const badgeLabel = criterionType === 'yes_no' ? t('No/Yes') : scoreLabel;

  return (
    <section className="flex flex-col gap-4 border-b border-neutral-gray1 pb-6">
      {criterionType === 'yes_no' ? (
        <>
          <FieldHeader title={field.schema.title} badge={badgeLabel} />

          <div className="flex items-start gap-3">
            {field.schema.description && (
              <p className="flex-1 text-base text-neutral-charcoal">
                {field.schema.description}
              </p>
            )}

            <RubricFieldInput field={field} value={value} onChange={onChange} />
          </div>
        </>
      ) : (
        <>
          <FieldHeader title={field.schema.title} badge={badgeLabel} />

          {field.schema.description && (
            <p className="text-base text-neutral-charcoal">
              {field.schema.description}
            </p>
          )}

          <RubricFieldInput field={field} value={value} onChange={onChange} />
        </>
      )}

      <RubricRationaleField
        value={rationaleValue}
        onChange={onRationaleChange}
        placeholder={rationalePlaceholder}
      />
    </section>
  );
}

/**
 * Optional long-text note under each criterion: collapsed behind an
 * "Add Note" button until the reviewer opens it (or a value already exists).
 */
function RubricRationaleField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(value.length > 0);

  if (!isOpen) {
    return (
      <Button
        variant="link"
        size="inline"
        className="flex items-center px-2 py-1.5 leading-normal text-primary-tealBlack"
        onPress={() => setIsOpen(true)}
      >
        <LuPlus className="size-4" />
        {t('Add Note')}
      </Button>
    );
  }

  const label = t('Notes');

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-neutral-black">{label}</span>
      <TextField
        aria-label={label}
        value={value}
        onChange={onChange}
        useTextArea
        textareaProps={{ placeholder, rows: 3, className: 'min-h-20' }}
      />
    </div>
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

      if (isOverallRecommendationField(field.key)) {
        const recOptions = parseSchemaOptions(field.schema);
        return (
          <RadioGroup
            aria-label={field.schema.title}
            value={typeof value === 'string' ? value : undefined}
            onChange={onChange}
            orientation="horizontal"
            className="gap-0"
          >
            {recOptions.map((option) => (
              <Radio key={String(option.value)} value={String(option.value)}>
                {option.title || String(option.value)}
              </Radio>
            ))}
          </RadioGroup>
        );
      }

      const options = parseSchemaOptions(field.schema).map((option) => ({
        value: option.value,
        label: option.title || String(option.value),
      }));
      const selectedKey =
        typeof value === 'string' || typeof value === 'number'
          ? String(value)
          : null;

      return (
        <Select
          aria-label={field.schema.title}
          placeholder={t('Select an option')}
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
