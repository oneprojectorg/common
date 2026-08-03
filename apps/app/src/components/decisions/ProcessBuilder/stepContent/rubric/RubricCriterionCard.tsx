'use client';

import { Button } from '@op/ui/Button';
import {
  CollapsibleConfigCard,
  CollapsibleConfigCardDragPreview,
} from '@op/ui/CollapsibleConfigCard';
import { NumberField } from '@op/ui/NumberField';
import { Radio, RadioGroup } from '@op/ui/RadioGroup';
import type { SortableItemControls } from '@op/ui/Sortable';
import { DragHandle, Sortable } from '@op/ui/Sortable';
import { TextField } from '@op/ui/TextField';
import { ToggleButton } from '@op/ui/ToggleButton';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { cn } from '@op/ui/utils';
import { useEffect, useRef, useState } from 'react';
import { LuGripVertical, LuPlus, LuTrash2, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n/routing';

import type {
  CriterionView,
  RubricCriterionType,
  SelectOption,
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
  onUpdateOptions?: (criterionId: string, options: SelectOption[]) => void;
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
  onUpdateOptions,
  onUpdateRequired,
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
        <div className="space-y-2.5 px-8">
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

          {criterion.criterionType === 'single_select' && (
            <>
              <hr />
              <SingleSelectCriterionConfig
                criterion={criterion}
                onUpdateOptions={(options) =>
                  onUpdateOptions?.(criterion.id, options)
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

          {/* Footer: Required toggle + Delete button */}
          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-2">
              <span className="text-neutral-charcoal">{t('Required?')}</span>
              <ToggleButton
                size="small"
                isSelected={criterion.required}
                onChange={(isSelected) =>
                  onUpdateRequired(criterion.id, isSelected)
                }
                aria-label={t('Required')}
              />
            </div>
            {onRemove && (
              <Button
                color="ghost"
                size="small"
                onPress={() => onRemove(criterion.id)}
                aria-label={t('Delete')}
                className="text-neutral-charcoal hover:text-functional-red"
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
                <span className="flex size-8 shrink-0 items-center justify-center rounded bg-neutral-gray1 text-center text-end font-serif text-title-base text-neutral-gray4">
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
// Single-select criterion config (option list)
// ---------------------------------------------------------------------------

/** Sortable row: `id` is the stored option id, `value` its display label. */
interface OptionRow {
  id: string;
  value: string;
  description?: string;
}

/**
 * Options editor for single-select criteria. Mirrors the proposal template's
 * FieldConfigDropdown UI: drag to reorder, min-2 removal guard, Enter adds
 * the next option. Each option carries an optional description, revealed via
 * an "Add a description" link. Manages its own row state (initialized on
 * mount) and reports the full option list on every change; row ids are the
 * stored option ids so relabels/reorders never break saved answers.
 */
function SingleSelectCriterionConfig({
  criterion,
  onUpdateOptions,
}: {
  criterion: CriterionView;
  onUpdateOptions: (options: SelectOption[]) => void;
}) {
  const t = useTranslations();
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldFocusNewRef = useRef(false);
  const focusDescriptionIdRef = useRef<string | null>(null);

  const [options, setOptions] = useState<OptionRow[]>(() =>
    criterion.options.map((o) => ({
      id: o.value,
      value: o.title,
      ...(o.description !== undefined ? { description: o.description } : {}),
    })),
  );

  const [openDescriptionIds, setOpenDescriptionIds] = useState<Set<string>>(
    () =>
      new Set(
        criterion.options
          .filter((o) => o.description !== undefined)
          .map((o) => o.value),
      ),
  );

  const updateOptions = (next: OptionRow[]) => {
    setOptions(next);
    onUpdateOptions(
      next.map((row) => ({
        value: row.id,
        title: row.value,
        ...(row.description !== undefined && row.description.trim() !== ''
          ? { description: row.description }
          : {}),
      })),
    );
  };

  // Focus the last input when a new option is added
  useEffect(() => {
    if (shouldFocusNewRef.current && containerRef.current) {
      const inputs = containerRef.current.querySelectorAll(
        'input[type="text"]',
      ) as NodeListOf<HTMLInputElement>;
      const lastInput = inputs[inputs.length - 1];
      lastInput?.focus();
      shouldFocusNewRef.current = false;
    }
  }, [options.length]);

  const renderDragPreview = (items: OptionRow[]) => {
    const item = items[0];
    if (!item) {
      return null;
    }
    return (
      <div className="flex items-center gap-2">
        <LuGripVertical className="size-4 text-neutral-gray3" />
        <span className="me-12 grow rounded-lg border border-neutral-gray2 bg-white px-4 py-3 text-neutral-charcoal shadow-lg">
          {item.value || t('Option')}
        </span>
      </div>
    );
  };

  const handleAddOption = () => {
    shouldFocusNewRef.current = true;
    updateOptions([
      ...options,
      { id: crypto.randomUUID().slice(0, 8), value: '' },
    ]);
  };

  const handleUpdateOption = (id: string, value: string) => {
    updateOptions(
      options.map((opt) => (opt.id === id ? { ...opt, value } : opt)),
    );
  };

  const handleUpdateOptionDescription = (id: string, description: string) => {
    updateOptions(
      options.map((opt) => (opt.id === id ? { ...opt, description } : opt)),
    );
  };

  const handleOpenDescription = (id: string) => {
    focusDescriptionIdRef.current = id;
    setOpenDescriptionIds((prev) => new Set(prev).add(id));
  };

  const handleRemoveOption = (id: string) => {
    updateOptions(options.filter((opt) => opt.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent, option: OptionRow) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const isLastOption = options[options.length - 1]?.id === option.id;
      if (isLastOption && option.value.trim()) {
        handleAddOption();
      }
    }
  };

  return (
    <div ref={containerRef} className="space-y-2">
      <h4 className="text-sm text-neutral-charcoal">{t('Options')}</h4>

      <Sortable
        items={options}
        onChange={updateOptions}
        dragTrigger="handle"
        getItemLabel={(item) => item.value || t('Option')}
        renderDragPreview={renderDragPreview}
        className="gap-2"
        aria-label={t('Options')}
      >
        {(option, controls) => {
          const index = options.findIndex((o) => o.id === option.id);
          return (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <DragHandle
                  {...controls.dragHandleProps}
                  aria-label={t('Drag to reorder option')}
                  className="text-neutral-gray3 hover:text-neutral-gray4"
                />
                <TextField
                  value={option.value}
                  onChange={(value) => handleUpdateOption(option.id, value)}
                  onKeyDown={(e) => handleKeyDown(e, option)}
                  inputProps={{
                    placeholder: t('Option {number}', { number: index + 1 }),
                    className: 'bg-white',
                  }}
                  className="w-full"
                />
                <TooltipTrigger isDisabled={options.length > 2}>
                  <Button
                    color="ghost"
                    size="small"
                    aria-label={t('Remove option')}
                    aria-disabled={options.length <= 2 || undefined}
                    aria-description={
                      options.length <= 2
                        ? t('At least two options are required')
                        : undefined
                    }
                    excludeFromTabOrder={options.length <= 2}
                    onPress={() => {
                      if (options.length > 2) {
                        handleRemoveOption(option.id);
                      }
                    }}
                    className={`p-2 ${
                      options.length <= 2
                        ? 'cursor-default text-neutral-gray3 opacity-30'
                        : 'text-neutral-gray3 hover:text-neutral-charcoal'
                    }`}
                  >
                    <LuX className="size-4" />
                  </Button>
                  <Tooltip>{t('At least two options are required')}</Tooltip>
                </TooltipTrigger>
              </div>

              {openDescriptionIds.has(option.id) ? (
                <TextField
                  aria-label={t('Description')}
                  useTextArea
                  autoFocus={focusDescriptionIdRef.current === option.id}
                  value={option.description ?? ''}
                  onChange={(value) =>
                    handleUpdateOptionDescription(option.id, value)
                  }
                  textareaProps={{
                    placeholder: t('Add a description'),
                    className: 'min-h-16 resize-none bg-white',
                  }}
                  className="ps-8 pe-10"
                />
              ) : (
                <Button
                  color="ghost"
                  size="small"
                  onPress={() => handleOpenDescription(option.id)}
                  className="ms-8 gap-1 self-start p-0 text-primary-teal hover:text-primary-tealBlack"
                >
                  <LuPlus className="size-4" />
                  <span>{t('Add a description')}</span>
                </Button>
              )}
            </div>
          );
        }}
      </Sortable>

      <Button
        color="ghost"
        size="small"
        onPress={handleAddOption}
        className="gap-1 p-0 text-primary-teal hover:text-primary-tealBlack"
      >
        <LuPlus className="size-4" />
        <span>{t('Add option')}</span>
      </Button>
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
