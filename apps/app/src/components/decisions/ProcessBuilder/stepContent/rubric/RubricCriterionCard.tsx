'use client';

import { Button } from '@op/sense/Button';
import {
  CollapsibleConfigCard,
  CollapsibleConfigCardDragPreview,
} from '@op/sense/CollapsibleConfigCard';
import { Field, FieldLabel, FieldLegend, FieldSet } from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupTextarea,
} from '@op/sense/InputGroup';
import { NumberField } from '@op/sense/NumberField';
import { RadioGroup, RadioGroupItem } from '@op/sense/RadioGroup';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import {
  DragHandle,
  Sortable,
  type SortableItemControls,
} from '@op/sense/Sortable';
import { Switch } from '@op/sense/Switch';
import { Textarea } from '@op/sense/Textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@op/sense/Tooltip';
import { cn } from '@op/sense/lib/utils';
import { useEffect, useId, useRef, useState } from 'react';
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
  const requiredToggleId = useId();

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
        <div className="space-y-2.5">
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
                className="min-h-24"
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
            <SingleSelectCriterionConfig
              criterion={criterion}
              onUpdateOptions={(options) =>
                onUpdateOptions?.(criterion.id, options)
              }
            />
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
          <div className="flex items-center justify-between gap-4 border-t pt-4">
            <Field orientation="horizontal" className="w-auto">
              <FieldLabel
                className="text-foreground"
                htmlFor={requiredToggleId}
              >
                {t('Required?')}
              </FieldLabel>
              <Switch
                id={requiredToggleId}
                checked={criterion.required}
                onCheckedChange={(isSelected) =>
                  onUpdateRequired(criterion.id, isSelected)
                }
                aria-label={t('Required')}
              />
            </Field>
            {onRemove && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onRemove(criterion.id)}
                aria-label={t('Delete')}
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
        id={`${criterion.id}-max-points`}
        label={t('Max points')}
        className="w-32"
        value={max}
        onChange={handleMaxPointsChange}
        errorMessage={max < 2 ? t('Minimum is 2') : undefined}
      />

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
                <span className="flex size-8 shrink-0 items-center justify-center rounded bg-secondary text-center font-serif text-label font-strong text-muted-foreground">
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
// Single-select criterion config (editable option list)
// ---------------------------------------------------------------------------

/** Sortable row: `id` is the stored option id, `value` its display label. */
interface OptionRow {
  id: string;
  value: string;
  description?: string;
}

/**
 * Editable option list for a single-select criterion: reorderable rows, each
 * with a label input and an optional "Add a description" textarea. Manages its
 * own row state (initialized on mount) and reports the full option list on
 * every change; row ids are the stored option ids so relabels/reorders never
 * break saved answers.
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
        <span className="me-12 grow rounded-lg border border-input bg-white px-4 py-3 text-foreground shadow-lg">
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

  const handleRemoveDescription = (id: string) => {
    // Clear the stored description too, so a collapsed field can't leave a
    // hidden-but-saved description on the option.
    handleUpdateOptionDescription(id, '');
    setOpenDescriptionIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
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
      <h4 className="text-strong">{t('Options')}</h4>
      <Sortable
        items={options}
        onChange={updateOptions}
        dragTrigger="handle"
        getItemLabel={(item) => item.value || t('Option')}
        renderDragPreview={renderDragPreview}
        className="gap-4"
        aria-label={t('Options')}
      >
        {(option, { dragHandleProps }) => {
          const index = options.findIndex((o) => o.id === option.id);
          const canRemove = options.length > 2;
          return (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <DragHandle
                  {...dragHandleProps}
                  aria-label={t('Drag to reorder option')}
                  className="text-neutral-gray3 hover:text-muted-foreground"
                />
                <Input
                  value={option.value}
                  onChange={(e) =>
                    handleUpdateOption(option.id, e.target.value)
                  }
                  onKeyDown={(e) => handleKeyDown(e, option)}
                  placeholder={t('Option {number}', { number: index + 1 })}
                  className="w-full bg-white"
                />

                <Tooltip disabled={canRemove}>
                  <TooltipTrigger
                    render={
                      // aria-disabled (not the `disabled` attr) so the button
                      // still receives hover/focus — a disabled <button> eats
                      // pointer events, so the tooltip explaining WHY would never
                      // fire. The onClick guard keeps it inert when blocked.
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={t('Remove option')}
                        aria-disabled={!canRemove || undefined}
                        className={cn(
                          !canRemove &&
                            'cursor-not-allowed opacity-50 hover:bg-transparent',
                        )}
                        onClick={() => {
                          if (canRemove) {
                            handleRemoveOption(option.id);
                          }
                        }}
                      >
                        <LuX className="size-4" />
                      </Button>
                    }
                  />
                  <TooltipContent>
                    {t('At least two options are required')}
                  </TooltipContent>
                </Tooltip>
              </div>

              {openDescriptionIds.has(option.id) ? (
                <div className="flex w-full flex-col gap-2">
                  <Textarea
                    aria-label={t('Description')}
                    autoFocus={focusDescriptionIdRef.current === option.id}
                    value={option.description ?? ''}
                    onChange={(e) =>
                      handleUpdateOptionDescription(option.id, e.target.value)
                    }
                    placeholder={t('Add a description')}
                    className="ms-8 min-h-16 w-[calc(100%-calc(--spacing*16))] resize-none bg-white"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRemoveDescription(option.id)}
                    className="ms-8 mb-4 self-start"
                  >
                    <LuX className="size-4" />
                    <span>{t('Remove description')}</span>
                  </Button>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleOpenDescription(option.id)}
                  className="ms-8 self-start"
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
        variant="ghost"
        onClick={handleAddOption}
        className="mt-2 hover:bg-secondary"
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
