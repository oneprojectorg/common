'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { getCurrencySymbol } from '@/utils/currency';
import {
  ProposalReviewState,
  type XFormatPropertySchema,
  getMoneyGroupCurrency,
  getMoneyGroupLineItems,
  getMoneyLineItemAmount,
  isOverallRecommendationField,
  parseSchemaOptions,
  setMoneyLineItemAmount,
  sumMoneyGroupTotal,
} from '@op/common/client';
import { AlertBanner } from '@op/ui/AlertBanner';
import { Button } from '@op/ui/Button';
import { NumberField } from '@op/ui/NumberField';
import { Radio, RadioGroup } from '@op/ui/RadioGroup';
import { Select, SelectItem } from '@op/ui/Select';
import { TextField } from '@op/ui/TextField';
import { ToggleButton } from '@op/ui/ToggleButton';
import type { Key } from 'react';
import { useState } from 'react';
import { LuCircleAlert, LuPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { FieldHeader } from '../forms/FieldHeader';
import { compileRubricSchema } from '../forms/rubric';
import type { FieldDescriptor } from '../forms/types';
import { getCriterionMaxPoints, inferCriterionType } from '../rubricTemplate';
import { MoneyTotalRow } from './MoneyTotalRow';
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
                className="cursor-pointer underline"
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
                  'Shared anonymously with the author after the review phase ends',
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
          <FieldHeader
            title={field.schema.title}
            badge={badgeLabel}
            required={field.required}
          />

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
            required={field.required}
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
      const criterionType = inferCriterionType(field.schema);

      if (criterionType === 'yes_no') {
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

      if (criterionType === 'single_select') {
        const options = parseSchemaOptions(field.schema);
        return (
          <Select
            aria-label={field.schema.title}
            placeholder={t('Select an option')}
            selectedKey={typeof value === 'string' ? value : null}
            onSelectionChange={(key) => {
              onChange(key === null ? null : String(key));
            }}
            className="w-full"
          >
            {options.map((option) => {
              const label = option.title || String(option.value);
              return (
                <SelectItem
                  key={String(option.value)}
                  id={String(option.value)}
                  textValue={label}
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
            {options.map((option) => {
              const triggerLabel = option.title
                ? `${option.value} - ${option.title}`
                : String(option.value);
              return (
                <SelectItem
                  key={String(option.value)}
                  id={String(option.value)}
                  textValue={triggerLabel}
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
              );
            })}
          </Select>
        );
      }

      return null;
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

    case 'money-group':
      return (
        <BudgetAddUpField field={field} value={value} onChange={onChange} />
      );

    default:
      return null;
  }
}

/**
 * Budget add-up: one money input per line item plus the derived total. The
 * total is never stored — it is summed from the line items on every render.
 * The group's currency is materialized into the stored answer on each edit,
 * so reviewers never pick one.
 */
function BudgetAddUpField({
  field,
  value,
  onChange,
}: {
  field: FieldDescriptor;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const lineItems = getMoneyGroupLineItems(field.schema);
  const currency = getMoneyGroupCurrency(field.schema, value);
  const currencySymbol = getCurrencySymbol(currency);
  const total = sumMoneyGroupTotal(field.schema, value);

  return (
    <div className="flex flex-col gap-4">
      {lineItems.map((lineItem) => (
        <NumberField
          key={lineItem.id}
          label={lineItem.title}
          isRequired={lineItem.required}
          labelClassName="text-base font-bold text-neutral-black"
          value={getMoneyLineItemAmount(value, lineItem.id)}
          onChange={(amount) =>
            onChange(
              setMoneyLineItemAmount(field.schema, value, lineItem.id, amount),
            )
          }
          prefixText={currencySymbol}
          minValue={0}
          inputProps={{ placeholder: '0.00' }}
          className="w-full"
        />
      ))}

      <MoneyTotalRow total={total} currency={currency} />
    </div>
  );
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
