'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import {
  ProposalReviewState,
  type SchemaOption,
  type XFormatPropertySchema,
  isOverallRecommendationField,
  parseSchemaOptions,
} from '@op/common/client';
import { Alert, AlertDescription, AlertTitle } from '@op/sense/Alert';
import { Button } from '@op/sense/Button';
import { Field, FieldLabel } from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { Switch } from '@op/sense/Switch';
import { Textarea } from '@op/sense/Textarea';
import { useState } from 'react';
import { LuCircleAlert, LuPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { FieldHeader } from '../forms/FieldHeader';
import { compileRubricSchema } from '../forms/rubric';
import type { FieldDescriptor } from '../forms/types';
import { getCriterionMaxPoints, inferCriterionType } from '../rubricTemplate';
import { useReviewForm } from './ReviewFormContext';
import { FormShell, TotalScoreCard } from './ReviewFormShell';
import { type PreviousReviewPhase, ReviewTabs } from './ReviewTabs';
import { SubmittedReviewView } from './SubmittedReviewView';
import { ViewRevisionRequestModal } from './ViewRevisionRequestModal';

/**
 * Right-hand "Review Proposal" panel. Behind the reviews-v2 flag, the
 * reviewer's own form is shown under a "My review" tab alongside an "Other
 * reviews" tab (when the current phase's `openReviews` is on) and one
 * "Reviews from {phase}" tab per earlier open review phase. With no tab
 * beyond "My review", the form renders on its own exactly as before.
 */
export function ReviewRubricForm({
  openReviews,
  previousReviewPhases,
}: {
  openReviews: boolean;
  previousReviewPhases: PreviousReviewPhase[];
}) {
  const reviewsV2Enabled = useFeatureFlag('reviews-v2') ?? false;
  const showOtherReviews = reviewsV2Enabled && openReviews;
  const previousPhases = reviewsV2Enabled ? previousReviewPhases : [];

  if (!showOtherReviews && previousPhases.length === 0) {
    return (
      <FormShell>
        <MyReviewForm />
      </FormShell>
    );
  }

  return (
    <FormShell>
      <ReviewTabs
        myReview={<MyReviewForm />}
        showOtherReviews={showOtherReviews}
        previousPhases={previousPhases}
      />
    </FormShell>
  );
}

/**
 * Schema-driven review rubric form renderer (the reviewer's own review).
 */
function MyReviewForm() {
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
    isEditing,
    review,
  } = useReviewForm();
  const fields = compileRubricSchema(template);

  const [isFeedbackOpen, setIsFeedbackOpen] = useState(
    overallComment.length > 0,
  );
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // A submitted review shows the read-only result unless the reviewer has
  // switched it back into the form via "Edit review".
  if (review?.state === ProposalReviewState.SUBMITTED && !isEditing) {
    return (
      <>
        <SubmittedReviewView rubricTemplate={template} review={review} />
        <TotalScoreCard rubricTemplate={template} values={values} />
      </>
    );
  }

  return (
    <>
      {isPausedForRevision && (
        <>
          <Alert variant="warning">
            <LuCircleAlert />
            <AlertTitle>{t('Proposal Revision Requested')}</AlertTitle>
            <AlertDescription>
              {t('Reviewing is paused until author submits a revision.')}{' '}
              <button
                type="button"
                className="cursor-pointer underline"
                onClick={() => setIsViewModalOpen(true)}
              >
                {t('View feedback')}
              </button>
            </AlertDescription>
          </Alert>

          <ViewRevisionRequestModal
            isOpen={isViewModalOpen}
            onOpenChange={setIsViewModalOpen}
          />
        </>
      )}

      {/* `inert` (not just pointer-events-none) so a paused form can't be
          reached or edited by keyboard either. */}
      <div
        inert={isPausedForRevision}
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
                  'Shared anonymously with the author after the review phase',
                )}
                className="gap-1"
              />

              <Textarea
                aria-label={t('Feedback to Author')}
                className="[unicode-bidi:plaintext]"
                value={overallComment}
                onChange={(event) =>
                  handleOverallCommentChange(event.target.value)
                }
                rows={3}
              />
            </section>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setIsFeedbackOpen(true)}
            >
              <LuPlus className="size-4" />
              {t('Feedback to author')}
            </Button>
          )}

          <TotalScoreCard rubricTemplate={template} values={values} />
        </div>
      </div>
    </>
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
          />

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
 * "Add note" button until the reviewer opens it (or a value already exists).
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
        size="sm"
        className="h-auto self-start px-2 py-1.5 leading-normal text-primary-tealBlack"
        onClick={() => setIsOpen(true)}
      >
        <LuPlus className="size-4" />
        {t('Add note')}
      </Button>
    );
  }

  const label = t('Note');

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-neutral-black">{label}</span>
      <Textarea
        aria-label={label}
        className="min-h-20 [unicode-bidi:plaintext]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
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
      const criterionType = inferCriterionType(field.schema);

      if (criterionType === 'yes_no') {
        return (
          <Switch
            size="sm"
            aria-label={field.schema.title}
            checked={value === 'yes'}
            onCheckedChange={(checked) => {
              onChange(checked ? 'yes' : 'no');
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
            onValueChange={onChange}
            className="flex flex-wrap items-center gap-x-6 gap-y-2"
          >
            {recOptions.map((option) => {
              const optionValue = String(option.value);
              const optionId = `${field.key}-${optionValue}`;
              return (
                <Field
                  key={optionValue}
                  orientation="horizontal"
                  className="w-auto"
                >
                  <RadioGroupItem id={optionId} value={optionValue} />
                  <FieldLabel htmlFor={optionId} className="font-normal">
                    {option.title || optionValue}
                  </FieldLabel>
                </Field>
              );
            })}
          </RadioGroup>
        );
      }

      if (criterionType === 'single_select') {
        const options = parseSchemaOptions(field.schema);
        return (
          <Select
            // base-ui renders the raw value in the trigger unless it can look
            // the label up — these are id-style values, so pass the map.
            items={getOptionLabels(options)}
            value={typeof value === 'string' ? value : null}
            onValueChange={(next: unknown) => {
              onChange(next === null ? null : String(next));
            }}
          >
            <SelectTrigger aria-label={field.schema.title} className="w-full">
              <SelectValue placeholder={t('Select an option')} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => {
                const label = option.title || String(option.value);
                return (
                  <SelectItem
                    key={String(option.value)}
                    value={String(option.value)}
                  >
                    {option.description ? (
                      <div className="flex flex-col">
                        <span>{label}</span>
                        <span className="text-sm text-neutral-gray4">
                          {option.description}
                        </span>
                      </div>
                    ) : (
                      label
                    )}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        );
      }

      if (criterionType === 'scored') {
        // Highest score first (to match the process builder); each option
        // renders the score with its description below so reviewers can
        // tell options apart on long scales.
        const options = [...parseSchemaOptions(field.schema)].sort(
          (a, b) => Number(b.value) - Number(a.value),
        );
        const selectedValue =
          typeof value === 'string' || typeof value === 'number'
            ? String(value)
            : null;

        return (
          <Select
            items={getScoredOptionLabels(options)}
            value={selectedValue}
            onValueChange={(next: unknown) => {
              onChange(parseSelectedValue(next, field.schema));
            }}
          >
            <SelectTrigger aria-label={field.schema.title} className="w-full">
              <SelectValue placeholder={t('Select an option')} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem
                  key={String(option.value)}
                  value={String(option.value)}
                >
                  {option.title ? (
                    <div className="flex flex-col">
                      <span>{option.value}</span>
                      <span className="text-sm text-neutral-gray4">
                        {option.title}
                      </span>
                    </div>
                  ) : (
                    String(option.value)
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }

      return null;
    }

    case 'long-text':
      return (
        <Textarea
          aria-label={field.schema.title}
          className="[unicode-bidi:plaintext]"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t('Start typing...')}
          rows={3}
        />
      );

    case 'short-text':
      return (
        <Input
          aria-label={field.schema.title}
          className="[unicode-bidi:plaintext]"
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t('Start typing...')}
        />
      );

    default:
      return null;
  }
}

/** value → label map so the Select trigger shows the option's title. */
function getOptionLabels(options: SchemaOption[]): Record<string, string> {
  return Object.fromEntries(
    options.map((option) => [
      String(option.value),
      option.title || String(option.value),
    ]),
  );
}

/** Scored options read "{score} - {title}" in the trigger. */
function getScoredOptionLabels(
  options: SchemaOption[],
): Record<string, string> {
  return Object.fromEntries(
    options.map((option) => [
      String(option.value),
      option.title ? `${option.value} - ${option.title}` : String(option.value),
    ]),
  );
}

/**
 * Convert a select value back into the schema's expected primitive type.
 */
function parseSelectedValue(
  key: unknown,
  schema: XFormatPropertySchema,
): string | number | null {
  if (key === null || key === undefined) {
    return null;
  }

  const value = String(key);

  if (schema.type === 'integer') {
    return Number(value);
  }

  return value;
}
