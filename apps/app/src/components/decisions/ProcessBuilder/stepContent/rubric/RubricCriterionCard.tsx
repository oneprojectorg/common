'use client';

import { Button } from '@op/ui/Button';
import {
  CollapsibleConfigCard,
  CollapsibleConfigCardDragPreview,
} from '@op/ui/CollapsibleConfigCard';
import { NumberField } from '@op/ui/NumberField';
import { Radio, RadioGroup } from '@op/ui/RadioGroup';
import type { SortableItemControls } from '@op/ui/Sortable';
import { TextField } from '@op/ui/TextField';
import { cn } from '@op/ui/utils';
import { useRef, useState } from 'react';
import { LuTrash2 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n/routing';

import type {
  CriterionView,
  RubricCriterionType,
} from '@/components/decisions/rubricTemplate';

import {
  CRITERION_TYPES,
  CRITERION_TYPE_REGISTRY,
} from './rubricCriterionRegistry';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RubricCriterionCardProps {
  criterion: CriterionView;
  errors?: TranslationKey[];
  controls?: SortableItemControls;
  isExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onRemove?: (criterionId: string) => void;
  onBlur?: (criterionId: string) => void;
  onUpdateLabel?: (criterionId: string, label: string) => void;
  onUpdateDescription?: (criterionId: string, description: string) => void;
  onChangeType?: (criterionId: string, newType: RubricCriterionType) => void;
  onUpdateMaxPoints?: (criterionId: string, maxPoints: number) => void;
  onUpdateScoreLabel?: (
    criterionId: string,
    scoreValue: number,
    label: string,
  ) => void;
  isNew?: boolean;
  onNewComplete?: (criterionId: string) => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * A collapsible card for a single rubric criterion.
 *
 * Uses CollapsibleConfigCard to match the proposal template FieldCard pattern:
 * drag handle + label in header, content with field name, description,
 * and criterion type selector.
 */
export function RubricCriterionCard({
  criterion,
  errors = [],
  controls,
  isExpanded,
  onExpandedChange,
  onRemove,
  onBlur,
  onUpdateLabel,
  onUpdateDescription,
  onChangeType,
  onUpdateMaxPoints,
  onUpdateScoreLabel,
  isNew,
  onNewComplete,
}: RubricCriterionCardProps) {
  const t = useTranslations();
  const cardRef = useRef<HTMLDivElement>(null);

  const displayLabel = criterion.label || t('Untitled field');

  const badgeLabel =
    criterion.criterionType === 'scored' && criterion.maxPoints
      ? `${criterion.maxPoints} ${t('pts')}`
      : t(CRITERION_TYPE_REGISTRY[criterion.criterionType].labelKey);

  // Only trigger validation when focus leaves the card entirely
  const handleBlur = (e: React.FocusEvent) => {
    if (cardRef.current && !cardRef.current.contains(e.relatedTarget as Node)) {
      onBlur?.(criterion.id);
    }
  };

  return (
    <div
      ref={cardRef}
      onBlur={handleBlur}
      onAnimationEnd={(e) => {
        if (e.animationName === 'border-highlight') {
          onNewComplete?.(criterion.id);
        }
      }}
      className="scroll-m-6"
    >
      <CollapsibleConfigCard
        label={displayLabel}
        badgeLabel={badgeLabel}
        badgeClassName="group-data-[expanded]/accordion-item:hidden"
        isCollapsible
        isExpanded={isExpanded}
        onExpandedChange={onExpandedChange}
        controls={controls}
        dragHandleAriaLabel={t('Drag to reorder criterion')}
        className={cn(
          'data-[expanded]:bg-neutral-offWhite',
          isNew && 'animate-border-highlight',
          errors.length > 0 && 'border-functional-red',
        )}
      >
        <div className="space-y-4 px-8">
          {/* Field name */}
          <TextField
            label={t('Field name')}
            isRequired
            value={criterion.label}
            onChange={(value) => onUpdateLabel?.(criterion.id, value)}
            maxLength={50}
            inputProps={{
              className: 'bg-white',
            }}
            className="min-w-0 flex-1"
          />

          {/* Description */}
          <TextField
            label={t('Description')}
            useTextArea
            value={criterion.description ?? ''}
            onChange={(value) => onUpdateDescription?.(criterion.id, value)}
            textareaProps={{
              placeholder: t('Provide additional guidance for participants...'),
              className: 'min-h-24 resize-none bg-white',
            }}
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
                onUpdateScoreLabel={(scoreValue, label) =>
                  onUpdateScoreLabel?.(criterion.id, scoreValue, label)
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

          {/* Footer */}
          {onRemove && (
            <div className="flex items-center justify-end border-t pt-4">
              <Button
                color="ghost"
                size="small"
                onPress={() => onRemove(criterion.id)}
                aria-label={t('Delete')}
                className="text-neutral-gray4 hover:text-functional-red"
              >
                <LuTrash2 className="size-4" />
                {t('Delete')}
              </Button>
            </div>
          )}
        </div>
      </CollapsibleConfigCard>
    </div>
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
      labelClassName="text-base"
    >
      {CRITERION_TYPES.map((type) => {
        const entry = CRITERION_TYPE_REGISTRY[type];
        return (
          <Radio
            key={type}
            value={type}
            className="group flex items-start gap-2 py-2"
          >
            <div className="relative -top-0.5">
              <span>{t(entry.labelKey)}</span>
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
  onUpdateScoreLabel: (scoreValue: number, label: string) => void;
}) {
  const t = useTranslations();
  const max = criterion.maxPoints ?? 5;

  // Cache descriptions that would be lost when maxPoints decreases.
  const [cachedDescriptions, setCachedDescriptions] = useState<
    Record<number, string>
  >({});

  const handleMaxPointsChange = (value: number | null) => {
    if (value === null || value < 2) {
      return;
    }

    const newMax = value;

    if (newMax < max) {
      const toCache: Record<number, string> = { ...cachedDescriptions };
      for (let i = newMax + 1; i <= max; i++) {
        const label = criterion.scoreLabels[i - 1];
        if (label) {
          toCache[i] = label;
        }
      }
      setCachedDescriptions(toCache);
    } else if (newMax > max) {
      const labelsToRestore: Array<{ score: number; label: string }> = [];
      for (let i = max + 1; i <= newMax; i++) {
        const cached = cachedDescriptions[i];
        if (cached) {
          labelsToRestore.push({ score: i, label: cached });
        }
      }

      if (labelsToRestore.length > 0) {
        const newCache = { ...cachedDescriptions };
        labelsToRestore.forEach(({ score }) => delete newCache[score]);
        setCachedDescriptions(newCache);

        setTimeout(() => {
          labelsToRestore.forEach(({ score, label }) => {
            onUpdateScoreLabel(score, label);
          });
        }, 0);
      }
    }

    onUpdateMaxPoints(newMax);
  };

  return (
    <div className="space-y-4">
      <NumberField
        label={t('Max points')}
        value={max}
        onChange={handleMaxPointsChange}
        errorMessage={max < 2 ? t('Minimum is 2') : undefined}
        inputProps={{ className: 'w-20' }}
      />

      <div className="space-y-2">
        <h4 className="text-neutral-charcoal">
          {t('Define what each score means')}
        </h4>
        <p className="text-sm">
          {t(
            'Help reviewers score consistently by describing what each point value represents',
          )}
        </p>
        <div className="space-y-4">
          {criterion.scoreLabels.map((_, i) => {
            const revIdx = criterion.scoreLabels.length - 1 - i;
            const label = criterion.scoreLabels[revIdx]!;
            const scoreValue = max - i;
            return (
              <div key={scoreValue} className="flex items-start gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded bg-neutral-gray1 text-center text-right font-serif text-title-base text-neutral-gray4">
                  {scoreValue}
                </span>
                <TextField
                  useTextArea
                  value={label}
                  onChange={(value) => onUpdateScoreLabel(scoreValue, value)}
                  textareaProps={{
                    placeholder: t('Describe what earns {number} points...', {
                      number: scoreValue,
                    }),
                  }}
                  className="w-full"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drag preview
// ---------------------------------------------------------------------------

export function RubricCriterionDragPreview({
  criterion,
}: {
  criterion: CriterionView;
}) {
  const t = useTranslations();
  return (
    <CollapsibleConfigCardDragPreview
      label={criterion.label || t('Untitled field')}
      badgeLabel={
        criterion.criterionType === 'scored' && criterion.maxPoints
          ? `${criterion.maxPoints} ${t('pts')}`
          : t(CRITERION_TYPE_REGISTRY[criterion.criterionType].labelKey)
      }
    />
  );
}

export function RubricCriterionDropIndicator() {
  return <div className="h-16 rounded-lg border bg-neutral-offWhite" />;
}
