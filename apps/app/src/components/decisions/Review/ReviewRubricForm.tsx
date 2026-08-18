'use client';

import {
  ProposalReviewState,
  type SchemaOption,
  type XFormatPropertySchema,
  isOverallRecommendationField,
  parseSchemaOptions,
} from '@op/common/client';
import { Alert, AlertDescription, AlertTitle } from '@op/sense/Alert';
import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { OptionBox } from '@op/sense/OptionBox';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { Switch } from '@op/sense/Switch';
import { Textarea } from '@op/sense/Textarea';
import { useId, useState } from 'react';
import { LuCircleAlert, LuPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { compileRubricSchema } from '../forms/rubric';
import type { FieldDescriptor } from '../forms/types';
import {
  YES_NO_VALUES,
  getCriterionMaxPoints,
  inferCriterionType,
} from '../rubricTemplate';
import { useRecommendationLabels } from '../useRecommendationLabels';
import { useReviewForm } from './ReviewFormContext';
import { FormShell, TotalScoreCard } from './ReviewFormShell';
import { type PreviousReviewPhase, ReviewTabs } from './ReviewTabs';
import { useTranslatedRubric } from './ReviewTranslationContext';
import { SubmittedReviewView } from './SubmittedReviewView';
import { ViewRevisionRequestModal } from './ViewRevisionRequestModal';

/**
 * Right-hand "Review Proposal" panel. The reviewer's own form is shown under a
 * "My review" tab alongside an "Other reviews" tab (when the current phase's
 * `openReviews` is on) and one "Reviews from {phase}" tab per earlier open
 * review phase. With no tab beyond "My review", the form renders on its own.
 */
export function ReviewRubricForm({
  previousReviewPhases,
}: {
  previousReviewPhases: PreviousReviewPhase[];
}) {
  const { openReviews } = useReviewForm().reviewSettings;

  if (!openReviews && previousReviewPhases.length === 0) {
    return <OwnReviewRubricForm />;
  }

  return (
    <FormShell>
      <ReviewTabs
        myReview={<MyReviewForm />}
        showOtherReviews={openReviews}
        previousPhases={previousReviewPhases}
      />
    </FormShell>
  );
}

/** The reviewer's own form alone, for hosts that already list other reviews. */
export function OwnReviewRubricForm() {
  return (
    <FormShell>
      <MyReviewForm />
    </FormShell>
  );
}

/**
 * Schema-driven review rubric form renderer (the reviewer's own review).
 *
 * `anonymousFeedback` off hides only the add button: an existing comment is
 * always re-submitted, so it must stay visible and editable.
 */
function MyReviewForm() {
  const t = useTranslations();
  const {
    reviewSettings: { anonymousFeedback },
    assignment,
    rubricTemplate: authoredTemplate,
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
  // Display copy only — option values, bounds and the required list are
  // untouched, so the answers this form collects are identical either way.
  const template = useTranslatedRubric(authoredTemplate, assignment.phaseId);
  const fields = compileRubricSchema(template);

  const [isFeedbackOpen, setIsFeedbackOpen] = useState(
    overallComment.length > 0,
  );
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // A submitted review shows the read-only result unless the reviewer has
  // switched it back into the form via "Edit review".
  if (review?.state === ProposalReviewState.SUBMITTED && !isEditing) {
    return (
      <SubmittedReviewView
        rubricTemplate={template}
        review={review}
        // Above the feedback block, per the design — hence the slot.
        scoreSlot={<TotalScoreCard rubricTemplate={template} values={values} />}
      />
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
              <Button
                variant="link"
                size="inline"
                className="text-sm underline"
                onClick={() => setIsViewModalOpen(true)}
              >
                {t('View feedback')}
              </Button>
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

          <TotalScoreCard rubricTemplate={template} values={values} />

          {isFeedbackOpen ? (
            <section className="border-t pt-6">
              <FeedbackToAuthorField
                value={overallComment}
                onChange={handleOverallCommentChange}
              />
            </section>
          ) : anonymousFeedback ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setIsFeedbackOpen(true)}
            >
              <LuPlus className="size-4" />
              {t('Feedback to author')}
            </Button>
          ) : null}
        </div>
      </div>
    </>
  );
}

/**
 * Render one rubric criterion as a sense `Field`: label, optional description,
 * then the control — with the reviewer's note as its own labelled field below.
 *
 * Only text inputs get a `<label for>`; `htmlFor` can't address a Select
 * trigger, Switch or RadioGroup, so those are named by `aria-labelledby`.
 * Prompts are `h4` either way — a long rubric is navigated by heading.
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
  const recommendation = useRecommendationLabels();
  const controlId = useId();
  const labelId = useId();
  const descriptionId = useId();

  const criterionType = inferCriterionType(field.schema);
  const scoreLabel = maxPoints > 0 ? `${maxPoints} ${t('pts')}` : null;
  const badgeLabel = criterionType === 'yes_no' ? t('No/Yes') : scoreLabel;
  const isTextInput =
    field.format === 'short-text' || field.format === 'long-text';
  const describedBy = field.schema.description ? descriptionId : undefined;

  // The recommendation criterion's prompt is our copy, not the admin's, so it
  // comes from the dictionary rather than from the schema it is stored in.
  const title = isOverallRecommendationField(field.key)
    ? recommendation.title
    : field.schema.title;

  // `labelId` goes on the title text, not the whole row: the badge is inside
  // the heading, and a control named by the row would announce "Innovation
  // 5 pts".
  const label = (
    <>
      <span id={labelId}>
        {title}
        {field.required ? <RequiredAsterisk /> : null}
      </span>
      {badgeLabel ? <Badge variant="secondary">{badgeLabel}</Badge> : null}
    </>
  );

  const control = (
    <RubricFieldInput
      field={field}
      value={value}
      onChange={onChange}
      controlId={controlId}
      labelledBy={isTextInput ? undefined : labelId}
      describedBy={describedBy}
    />
  );

  return (
    <section className="border-b pb-6">
      {/* Yes/no reads as a setting: badge top-right in the header row, then
          the switch beside the description, top-aligned. */}
      {criterionType === 'yes_no' ? (
        // One `dir="auto"` for the whole field rather than one per part:
        // resolved separately, each element reads from its own text, so the
        // title (which also carries the points badge) can land on the opposite
        // side from its own description.
        <Field dir="auto">
          <FieldTitle
            render={<h4 />}
            className="flex w-full items-start justify-between gap-2"
          >
            {label}
          </FieldTitle>
          <div className="flex w-full items-start justify-end gap-3">
            {field.schema.description ? (
              <FieldDescription id={descriptionId} className="flex-1">
                {field.schema.description}
              </FieldDescription>
            ) : null}
            {control}
          </div>
        </Field>
      ) : (
        <Field dir="auto">
          {isTextInput ? (
            <h4>
              <FieldLabel htmlFor={controlId}>{label}</FieldLabel>
            </h4>
          ) : (
            <FieldTitle
              render={<h4 />}
              className="flex w-full items-start justify-between gap-2"
            >
              {label}
            </FieldTitle>
          )}
          {field.schema.description ? (
            <FieldDescription id={descriptionId}>
              {field.schema.description}
            </FieldDescription>
          ) : null}
          {control}
        </Field>
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
 * Optional note under each criterion: collapsed behind an "Add note" button
 * until the reviewer opens it (or a value already exists).
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
  const noteId = useId();
  const [isOpen, setIsOpen] = useState(value.length > 0);

  if (!isOpen) {
    return (
      <Button
        variant="link"
        size="sm"
        className="mt-4 h-auto self-start px-2 py-1.5 leading-normal"
        onClick={() => setIsOpen(true)}
      >
        <LuPlus className="size-4" />
        {t('Add note')}
      </Button>
    );
  }

  return (
    <Field className="mt-4">
      <FieldLabel htmlFor={noteId}>{t('Note')}</FieldLabel>
      <Textarea
        id={noteId}
        className="min-h-20"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
      />
    </Field>
  );
}

/**
 * Feedback shared with the author after the review phase — one field for the
 * whole review rather than per criterion.
 */
function FeedbackToAuthorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations();
  const fieldId = useId();

  return (
    <Field>
      <FieldLabel htmlFor={fieldId}>{t('Feedback to Author')}</FieldLabel>
      <FieldDescription>
        {t('Shared anonymously with the author after the review phase')}
      </FieldDescription>
      <Textarea
        id={fieldId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
      />
    </Field>
  );
}

/**
 * Render the input control for a rubric field.
 */
function RubricFieldInput({
  field,
  value,
  onChange,
  controlId,
  labelledBy,
  describedBy,
}: {
  field: FieldDescriptor;
  value: unknown;
  onChange: (value: unknown) => void;
  controlId: string;
  /** Set for controls a `<label for>` can't address (buttons, groups). */
  labelledBy?: string;
  describedBy?: string;
}) {
  const t = useTranslations();
  const recommendation = useRecommendationLabels();

  switch (field.format) {
    case 'dropdown': {
      const criterionType = inferCriterionType(field.schema);

      if (criterionType === 'yes_no') {
        return (
          <Switch
            size="sm"
            id={controlId}
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
            checked={value === YES_NO_VALUES.yes}
            onCheckedChange={(checked) => {
              onChange(checked ? YES_NO_VALUES.yes : YES_NO_VALUES.no);
            }}
          />
        );
      }

      if (isOverallRecommendationField(field.key)) {
        const recOptions = parseSchemaOptions(field.schema);
        return (
          <RadioGroup
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
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
                    {/* Ours, so localized here; the schema's English label is
                        only a fallback for a value we don't recognize. */}
                    {recommendation.label(option.value) ??
                      option.title ??
                      optionValue}
                  </FieldLabel>
                </Field>
              );
            })}
          </RadioGroup>
        );
      }

      if (criterionType === 'single_select') {
        const options = parseSchemaOptions(field.schema);

        // "Multiple choice" holds exactly one value, so radios, not checkboxes.
        return (
          <RadioGroup
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
            value={typeof value === 'string' ? value : undefined}
            onValueChange={onChange}
            className="gap-2"
          >
            {options.map((option) => {
              const optionValue = String(option.value);
              const optionId = `${controlId}-${optionValue}`;

              return (
                <OptionBox
                  key={optionValue}
                  htmlFor={optionId}
                  control={<RadioGroupItem id={optionId} value={optionValue} />}
                  dir="auto"
                  label={option.title || optionValue}
                  description={option.description}
                />
              );
            })}
          </RadioGroup>
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
            onValueChange={(next) => {
              onChange(parseSelectedValue(next, field.schema));
            }}
          >
            <SelectTrigger
              id={controlId}
              aria-labelledby={labelledBy}
              aria-describedby={describedBy}
              className="w-full"
            >
              <SelectValue placeholder={t('Select an option')} />
            </SelectTrigger>
            {/* The popup is portaled, so it inherits nothing from the field —
                it resolves its own direction from the option labels. */}
            <SelectContent className={'max-w-(--anchor-width)'} dir="auto">
              <SelectGroup>
                {options.map((option) => (
                  <SelectItem
                    key={String(option.value)}
                    value={String(option.value)}
                  >
                    {option.title ? (
                      <div className="flex flex-col">
                        <span>{option.value}</span>
                        <span className="text-sm text-muted-foreground">
                          {option.title}
                        </span>
                      </div>
                    ) : (
                      String(option.value)
                    )}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        );
      }

      return null;
    }

    case 'long-text':
      return (
        <Textarea
          id={controlId}
          aria-describedby={describedBy}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t('Start typing...')}
          rows={3}
        />
      );

    case 'short-text':
      return (
        <Input
          id={controlId}
          aria-describedby={describedBy}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t('Start typing...')}
        />
      );

    default:
      return null;
  }
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
 * Convert a select value back into the schema's expected primitive type. The
 * options are keyed by `String(option.value)`, so the selection arrives as a
 * string and an integer-typed criterion has to be coerced back.
 */
function parseSelectedValue(
  selected: string | null,
  schema: XFormatPropertySchema,
): string | number | null {
  if (selected === null) {
    return null;
  }

  if (schema.type === 'integer') {
    return Number(selected);
  }

  return selected;
}
