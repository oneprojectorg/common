'use client';

import {
  AccordionContent,
  AccordionHeader,
  AccordionIndicator,
  AccordionTrigger,
} from '@op/ui/Accordion';
import { Button } from '@op/ui/Button';
import { NumberField } from '@op/ui/NumberField';
import { Radio, RadioGroup } from '@op/ui/RadioGroup';
import { DragHandle } from '@op/ui/Sortable';
import type { SortableItemControls } from '@op/ui/Sortable';
import { TextField } from '@op/ui/TextField';
import { LuGripVertical, LuTrash2 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type {
  CriterionView,
  RubricCriterionType,
} from '../../../../decisions/rubricTemplate';
import {
  CRITERION_TYPES,
  CRITERION_TYPE_REGISTRY,
} from './rubricCriterionRegistry';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RubricCriterionCardProps {
  criterion: CriterionView;
  /** 1-based display index for the header (e.g. "Criterion 1") */
  index: number;
  errors?: string[];
  controls?: SortableItemControls;
  onRemove?: (criterionId: string) => void;
  onUpdateLabel?: (criterionId: string, label: string) => void;
  onUpdateDescription?: (criterionId: string, description: string) => void;
  onChangeType?: (criterionId: string, newType: RubricCriterionType) => void;
  onUpdateMaxPoints?: (criterionId: string, maxPoints: number) => void;
  onUpdateScoreLabel?: (
    criterionId: string,
    scoreIndex: number,
    label: string,
  ) => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * A collapsible accordion card for a single rubric criterion.
 *
 * Built directly with Accordion primitives (not FieldConfigCard) to match
 * the mockup: static "Criterion N" header, separate name/description fields
 * in the body, and a criterion type radio selector.
 *
 * Must be rendered inside an `<AccordionItem>` which is inside an `<Accordion>`.
 */
export function RubricCriterionCard({
  criterion,
  index,
  errors = [],
  controls,
  onRemove,
  onUpdateLabel,
  onUpdateDescription,
  onChangeType,
  onUpdateMaxPoints,
  onUpdateScoreLabel,
}: RubricCriterionCardProps) {
  const t = useTranslations();

  return (
    <>
      {/* Header: drag handle + chevron + "Criterion N" + delete button */}
      <AccordionHeader className="flex items-center gap-2 px-3 py-2">
        {controls && (
          <DragHandle
            {...controls.dragHandleProps}
            aria-label={t('Drag to reorder criterion')}
          />
        )}
        <AccordionTrigger className="flex flex-1 cursor-pointer items-center gap-2">
          <AccordionIndicator />
          <span className="flex-1 font-medium text-neutral-charcoal">
            {t('Criterion {number}', { number: index })}
          </span>
        </AccordionTrigger>
        {onRemove && (
          <Button
            color="ghost"
            size="small"
            aria-label={t('Remove criterion')}
            onPress={() => onRemove(criterion.id)}
            className="p-2 text-neutral-gray4 hover:text-functional-red"
          >
            <LuTrash2 className="size-4" />
          </Button>
        )}
      </AccordionHeader>

      {/* Collapsible body */}
      <AccordionContent>
        <div className="space-y-4 px-4 pb-4">
          {/* Criterion name */}
          <TextField
            label={t('Criterion name')}
            isRequired
            value={criterion.label}
            onChange={(value) => onUpdateLabel?.(criterion.id, value)}
            inputProps={{
              placeholder: t('e.g., Goal Alignment'),
            }}
            description={t(
              'Add a short, clear name for this evaluation criterion',
            )}
          />

          {/* Description */}
          <TextField
            label={t('Description')}
            isRequired
            useTextArea
            value={criterion.description ?? ''}
            onChange={(value) => onUpdateDescription?.(criterion.id, value)}
            textareaProps={{
              placeholder: t(
                "What should reviewers evaluate? Be specific about what you're looking for.",
              ),
              className: 'min-h-24 resize-none',
            }}
            description={t('Help reviewers understand what to assess')}
          />

          <hr />

          {/* Criterion type radio selector */}
          <CriterionTypeSelector
            value={criterion.criterionType}
            onChange={(newType) => onChangeType?.(criterion.id, newType)}
          />

          {/* Type-specific configuration */}
          {criterion.criterionType === 'scored' && (
            <>
              <hr />
              <ScoredCriterionConfig
                criterion={criterion}
                onUpdateMaxPoints={(max) =>
                  onUpdateMaxPoints?.(criterion.id, max)
                }
                onUpdateScoreLabel={(scoreIndex, label) =>
                  onUpdateScoreLabel?.(criterion.id, scoreIndex, label)
                }
              />
            </>
          )}

          {/* Validation errors */}
          {errors.length > 0 && (
            <div className="space-y-1">
              {errors.map((error) => (
                <p key={error} className="text-sm text-functional-red">
                  {t(error)}
                </p>
              ))}
            </div>
          )}
        </div>
      </AccordionContent>
    </>
  );
}

// ---------------------------------------------------------------------------
// Criterion type radio selector
// ---------------------------------------------------------------------------

function CriterionTypeSelector({
  value,
  onChange,
}: {
  value: RubricCriterionType;
  onChange: (type: RubricCriterionType) => void;
}) {
  const t = useTranslations();

  return (
    <RadioGroup
      label={t('How should reviewers score this?')}
      value={value}
      onChange={(newValue) => onChange(newValue as RubricCriterionType)}
      orientation="vertical"
    >
      {CRITERION_TYPES.map((type) => {
        const entry = CRITERION_TYPE_REGISTRY[type];
        return (
          <Radio
            key={type}
            value={type}
            className="group flex items-start gap-2 py-2"
          >
            <div>
              <span className="text-sm font-medium text-neutral-charcoal">
                {t(entry.labelKey)}
              </span>
              <p className="text-sm text-neutral-gray4">
                {t(entry.descriptionKey)}
              </p>
            </div>
          </Radio>
        );
      })}
    </RadioGroup>
  );
}

// ---------------------------------------------------------------------------
// Scored criterion config (max points + score labels)
// ---------------------------------------------------------------------------

function ScoredCriterionConfig({
  criterion,
  onUpdateMaxPoints,
  onUpdateScoreLabel,
}: {
  criterion: CriterionView;
  onUpdateMaxPoints: (max: number) => void;
  onUpdateScoreLabel: (index: number, label: string) => void;
}) {
  const t = useTranslations();
  const max = criterion.maxPoints ?? 5;

  return (
    <div className="space-y-4">
      <NumberField
        label={t('Max points')}
        value={max}
        onChange={(value) => {
          if (value !== null && value >= 2 && value <= 10) {
            onUpdateMaxPoints(value);
          }
        }}
        inputProps={{ className: 'w-20' }}
      />

      <div className="space-y-2">
        <h4 className="text-sm text-neutral-charcoal">{t('Score labels')}</h4>
        {criterion.scoreLabels.map((label, scoreIndex) => (
          <div key={scoreIndex} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-right text-sm text-neutral-gray4">
              {scoreIndex + 1}
            </span>
            <TextField
              value={label}
              onChange={(value) => onUpdateScoreLabel(scoreIndex, value)}
              inputProps={{
                placeholder: t('Label for score {number}', {
                  number: scoreIndex + 1,
                }),
              }}
              className="w-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drag preview
// ---------------------------------------------------------------------------

export function RubricCriterionDragPreview({ index }: { index: number }) {
  const t = useTranslations();
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 shadow-lg">
      <LuGripVertical className="size-4 text-neutral-gray4" />
      <span className="font-medium text-neutral-charcoal">
        {t('Criterion {number}', { number: index })}
      </span>
    </div>
  );
}

export function RubricCriterionDropIndicator() {
  return (
    <div className="flex h-12 items-center gap-2 rounded-lg border bg-neutral-offWhite" />
  );
}
