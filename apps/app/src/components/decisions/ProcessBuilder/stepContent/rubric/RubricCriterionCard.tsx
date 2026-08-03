'use client';

import { Button } from '@op/sense/Button';
import {
  CollapsibleConfigCard,
  CollapsibleConfigCardDragPreview,
} from '@op/sense/CollapsibleConfigCard';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupTextarea,
} from '@op/sense/InputGroup';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import type { SortableItemControls } from '@op/sense/Sortable';
import { Switch } from '@op/sense/Switch';
import { Textarea } from '@op/sense/Textarea';
import { cn } from '@op/sense/lib/utils';
import { useEffect, useId, useRef, useState } from 'react';
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
// Numeric input helpers (ported from the removed op-ui NumberField, which has
// no sense equivalent — keeps Arabic/Persian digit normalization + filtering)
// ---------------------------------------------------------------------------

// Normalize non-ASCII numerals to ASCII so the field accepts Arabic input.
const normalizeDigits = (value: string) =>
  value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.')
    .replace(/٬/g, '');

const filterNumericInput = (value: string) =>
  normalizeDigits(value)
    .replace(/[^0-9.-]/g, '')
    .replace(/(?!^)-/g, '')
    .replace(/\.(?=.*\.)/g, '');

const parseNumericValue = (value: string): number | null => {
  const filtered = filterNumericInput(value);
  if (filtered === '' || filtered === '-') {
    return null;
  }
  const parsed = parseFloat(filtered);
  return isNaN(parsed) ? null : parsed;
};

const MAX_LABEL_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 250;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RubricCriterionCardProps {
  criterion: CriterionView;
  errors?: TranslationKey[];
  // Required by @op/sense CollapsibleConfigCard's editable-card union (always
  // supplied by the Sortable render prop that mounts this card).
  controls: SortableItemControls;
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
  onUpdateRequired: (criterionId: string, required: boolean) => void;
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
  onUpdateRequired,
  isNew,
  onNewComplete,
}: RubricCriterionCardProps) {
  const t = useTranslations();
  const cardRef = useRef<HTMLDivElement>(null);

  const displayLabel = criterion.label || t('Untitled');

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
        isCollapsible
        isExpanded={isExpanded}
        onExpandedChange={onExpandedChange}
        controls={controls}
        dragHandleAriaLabel={t('Drag to reorder criterion')}
        className={cn(
          'data-open:bg-muted',
          isNew && 'animate-border-highlight',
          errors.length > 0 && 'border-destructive',
        )}
      >
        <div className="space-y-2.5 px-8">
          {/* Label */}
          <Field className="min-w-0 flex-1">
            <FieldLabel htmlFor={`${criterion.id}-label`}>
              {t('Label')} <RequiredAsterisk />
            </FieldLabel>
            <InputGroup className="bg-white">
              <InputGroupInput
                id={`${criterion.id}-label`}
                required
                maxLength={MAX_LABEL_LENGTH}
                value={criterion.label}
                onChange={(e) => onUpdateLabel?.(criterion.id, e.target.value)}
                className="[unicode-bidi:plaintext]"
              />
              <InputGroupAddon align="inline-end">
                {t('{count}/{max}', {
                  count: criterion.label.length,
                  max: MAX_LABEL_LENGTH,
                })}
              </InputGroupAddon>
            </InputGroup>
          </Field>

          {/* Description */}
          <Field>
            <FieldLabel htmlFor={`${criterion.id}-description`}>
              {t('Description')}
            </FieldLabel>
            <InputGroup className="bg-white">
              <InputGroupTextarea
                id={`${criterion.id}-description`}
                value={criterion.description ?? ''}
                onChange={(e) =>
                  onUpdateDescription?.(criterion.id, e.target.value)
                }
                maxLength={MAX_DESCRIPTION_LENGTH}
                placeholder={t(
                  'Provide additional guidance for participants...',
                )}
                className="min-h-24 [unicode-bidi:plaintext]"
              />
              <InputGroupAddon align="block-end" className="justify-end">
                {t('{count}/{max}', {
                  count: criterion.description?.length ?? 0,
                  max: MAX_DESCRIPTION_LENGTH,
                })}
              </InputGroupAddon>
            </InputGroup>
          </Field>

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
                <p key={error} className="text-sm text-destructive">
                  {t(error)}
                </p>
              ))}
            </div>
          )}

          {/* Footer: Required toggle + Delete button */}
          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-2">
              <span className="text-foreground">{t('Required?')}</span>
              <Switch
                size="sm"
                checked={criterion.required}
                onCheckedChange={(isSelected) =>
                  onUpdateRequired(criterion.id, isSelected)
                }
                aria-label={t('Required')}
              />
            </div>
            {onRemove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(criterion.id)}
                aria-label={t('Delete')}
                className="text-destructive hover:text-destructive"
              >
                <LuTrash2 className="size-4" />
                {t('Delete')}
              </Button>
            )}
          </div>
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
  const groupId = useId();

  return (
    <FieldSet>
      <FieldLegend className="text-base">
        {t('How should reviewers score this?')}
      </FieldLegend>
      <RadioGroup
        value={value}
        onValueChange={(newValue) => onChange(newValue as RubricCriterionType)}
      >
        {CRITERION_TYPES.map((type) => {
          const entry = CRITERION_TYPE_REGISTRY[type];
          const id = `${groupId}-${type}`;
          return (
            <Field
              key={type}
              orientation="horizontal"
              className="items-start py-2"
            >
              <RadioGroupItem id={id} value={type} className="mt-0.5" />
              <FieldLabel htmlFor={id}>
                <div className="relative -top-0.5">
                  <span>{t(entry.labelKey)}</span>
                  <p className="text-sm text-muted-foreground">
                    {t(entry.descriptionKey)}
                  </p>
                </div>
              </FieldLabel>
            </Field>
          );
        })}
      </RadioGroup>
    </FieldSet>
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

  // Local display string for the numeric input (the old NumberField owned this
  // internally). Kept in sync when `max` changes from elsewhere.
  const [displayValue, setDisplayValue] = useState(String(max));
  useEffect(() => {
    setDisplayValue(String(max));
  }, [max]);

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
      <Field data-invalid={max < 2}>
        <FieldLabel htmlFor={`${criterion.id}-max-points`}>
          {t('Max points')}
        </FieldLabel>
        <Input
          id={`${criterion.id}-max-points`}
          inputMode="numeric"
          dir="ltr"
          className="w-20"
          value={displayValue}
          onChange={(e) => {
            const filtered = filterNumericInput(e.target.value);
            setDisplayValue(filtered);
            handleMaxPointsChange(parseNumericValue(filtered));
          }}
          aria-invalid={max < 2}
        />
        {max < 2 && <FieldError>{t('Minimum is 2')}</FieldError>}
      </Field>

      <div className="space-y-2">
        <h4 className="text-foreground">{t('Define what each score means')}</h4>
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
                <span className="flex size-8 shrink-0 items-center justify-center rounded bg-muted text-center font-serif text-title-base text-muted-foreground">
                  {scoreValue}
                </span>
                <Textarea
                  value={label}
                  onChange={(e) =>
                    onUpdateScoreLabel(scoreValue, e.target.value)
                  }
                  placeholder={t('Describe what earns {number} points...', {
                    number: scoreValue,
                  })}
                  className="w-full [unicode-bidi:plaintext]"
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
      label={criterion.label || t('Untitled')}
      badgeLabel={
        criterion.criterionType === 'scored' && criterion.maxPoints
          ? `${criterion.maxPoints} ${t('pts')}`
          : t(CRITERION_TYPE_REGISTRY[criterion.criterionType].labelKey)
      }
    />
  );
}

export function RubricCriterionDropIndicator() {
  return <div className="h-16 rounded-lg border bg-muted" />;
}
