'use client';

import type { XFormatPropertySchema } from '@op/common/client';
import { Button } from '@op/ui/Button';
import {
  FieldConfigCard,
  FieldConfigCardDragPreview,
} from '@op/ui/FieldConfigCard';
import { NumberField } from '@op/ui/NumberField';
import { Radio, RadioGroup } from '@op/ui/RadioGroup';
import { DragHandle, Sortable } from '@op/ui/Sortable';
import type { SortableItemControls } from '@op/ui/Sortable';
import { TextField } from '@op/ui/TextField';
import { ToggleButton } from '@op/ui/ToggleButton';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { useEffect, useRef, useState } from 'react';
import { LuGripVertical, LuPlus, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type {
  CriterionView,
  RubricCriterionType,
} from '../../../../decisions/rubricTemplate';
import {
  CRITERION_TYPES,
  CRITERION_TYPE_REGISTRY,
  getCriterionIcon,
} from './rubricCriterionRegistry';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RubricCriterionCardProps {
  criterion: CriterionView;
  errors?: string[];
  controls?: SortableItemControls;
  onRemove?: (criterionId: string) => void;
  onBlur?: (criterionId: string) => void;
  onUpdateLabel?: (criterionId: string, label: string) => void;
  onUpdateDescription?: (criterionId: string, description: string) => void;
  onUpdateRequired?: (criterionId: string, isRequired: boolean) => void;
  onChangeType?: (criterionId: string, newType: RubricCriterionType) => void;
  onUpdateJsonSchema?: (
    criterionId: string,
    updates: Partial<XFormatPropertySchema>,
  ) => void;
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
 * A collapsible card representing a single rubric criterion in the builder.
 * Uses FieldConfigCard with `collapsible` prop for accordion behaviour.
 *
 * Collapsed: drag handle + chevron + icon + label + badge + remove
 * Expanded: description, criterion type radio, type-specific config, required toggle
 */
export function RubricCriterionCard({
  criterion,
  errors = [],
  controls,
  onRemove,
  onBlur,
  onUpdateLabel,
  onUpdateDescription,
  onUpdateRequired,
  onChangeType,
  onUpdateJsonSchema,
  onUpdateMaxPoints,
  onUpdateScoreLabel,
}: RubricCriterionCardProps) {
  const t = useTranslations();
  const cardRef = useRef<HTMLDivElement>(null);

  const Icon = getCriterionIcon(criterion.criterionType);

  const handleBlur = (e: React.FocusEvent) => {
    if (cardRef.current && !cardRef.current.contains(e.relatedTarget as Node)) {
      onBlur?.(criterion.id);
    }
  };

  // Badge for the header
  const headerBadge = (() => {
    switch (criterion.criterionType) {
      case 'scored':
        return (
          <span className="bg-primary-mint/20 text-primary-tealDark shrink-0 rounded-sm px-1.5 py-0.5 text-xs">
            {criterion.maxPoints} {t('pts')}
          </span>
        );
      case 'yes_no':
        return (
          <span className="shrink-0 rounded-sm bg-neutral-gray1 px-1.5 py-0.5 text-xs text-neutral-charcoal">
            {t('Yes / No')}
          </span>
        );
      default:
        return null;
    }
  })();

  return (
    <div ref={cardRef} onBlur={handleBlur}>
      <FieldConfigCard
        collapsible
        icon={Icon}
        iconTooltip={t(
          CRITERION_TYPE_REGISTRY[criterion.criterionType].labelKey,
        )}
        label={criterion.label}
        onLabelChange={(newLabel) => onUpdateLabel?.(criterion.id, newLabel)}
        labelInputAriaLabel={t('Criterion label')}
        description={criterion.description}
        onDescriptionChange={(desc) =>
          onUpdateDescription?.(criterion.id, desc)
        }
        descriptionLabel={t('Description')}
        descriptionPlaceholder={t(
          'Provide guidance for reviewers on how to evaluate this criterion...',
        )}
        onRemove={onRemove ? () => onRemove(criterion.id) : undefined}
        removeAriaLabel={t('Remove criterion')}
        dragHandleAriaLabel={t('Drag to reorder {field}', {
          field: criterion.label,
        })}
        controls={controls}
        headerExtra={headerBadge}
        className={errors.length > 0 ? 'border-functional-red' : undefined}
      >
        {/* Criterion type selector */}
        <div className="mt-4">
          <CriterionTypeSelector
            value={criterion.criterionType}
            onChange={(newType) => onChangeType?.(criterion.id, newType)}
          />
        </div>

        {/* Type-specific configuration */}
        {criterion.criterionType === 'scored' && (
          <div className="mt-4">
            <ScoredCriterionConfig
              criterion={criterion}
              onUpdateMaxPoints={(max) =>
                onUpdateMaxPoints?.(criterion.id, max)
              }
              onUpdateScoreLabel={(index, label) =>
                onUpdateScoreLabel?.(criterion.id, index, label)
              }
            />
          </div>
        )}

        {criterion.criterionType === 'dropdown' && (
          <div className="mt-4">
            <DropdownCriterionConfig
              criterion={criterion}
              onUpdateJsonSchema={(updates) =>
                onUpdateJsonSchema?.(criterion.id, updates)
              }
            />
          </div>
        )}

        {/* Validation errors */}
        {errors.length > 0 && (
          <div className="mt-4 space-y-1">
            {errors.map((error) => (
              <p key={error} className="text-functional-red">
                {t(error)}
              </p>
            ))}
          </div>
        )}

        {/* Required toggle */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-neutral-charcoal">{t('Required?')}</span>
          <ToggleButton
            size="small"
            isSelected={criterion.required}
            onChange={(isSelected) =>
              onUpdateRequired?.(criterion.id, isSelected)
            }
            aria-label={t('Required')}
          />
        </div>
      </FieldConfigCard>
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
      label={t('Criterion type')}
      value={value}
      onChange={(newValue) => onChange(newValue as RubricCriterionType)}
      orientation="vertical"
    >
      {CRITERION_TYPES.map((type) => {
        const entry = CRITERION_TYPE_REGISTRY[type];
        const TypeIcon = entry.icon;
        return (
          <Radio
            key={type}
            value={type}
            className="group flex items-start gap-2 py-1.5"
          >
            <div className="flex items-center gap-2">
              <TypeIcon className="size-4 text-neutral-gray4" />
              <span className="text-sm font-medium">{t(entry.labelKey)}</span>
              <span className="text-xs text-neutral-gray4">
                {t(entry.descriptionKey)}
              </span>
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
        {criterion.scoreLabels.map((label, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-right text-sm text-neutral-gray4">
              {index + 1}
            </span>
            <TextField
              value={label}
              onChange={(value) => onUpdateScoreLabel(index, value)}
              inputProps={{
                placeholder: t('Label for score {number}', {
                  number: index + 1,
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
// Dropdown criterion config (custom options list)
// Reuses the same sortable options pattern as FieldConfigDropdown
// ---------------------------------------------------------------------------

interface DropdownOption {
  id: string;
  value: string;
}

function DropdownCriterionConfig({
  criterion,
  onUpdateJsonSchema,
}: {
  criterion: CriterionView;
  onUpdateJsonSchema: (updates: Partial<XFormatPropertySchema>) => void;
}) {
  const t = useTranslations();
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldFocusNewRef = useRef(false);

  const [options, setOptions] = useState<DropdownOption[]>(() =>
    criterion.options.map((o) => ({ ...o, id: crypto.randomUUID() })),
  );

  const updateOptions = (next: DropdownOption[]) => {
    setOptions(next);
    const oneOfValues = next.map((o) => ({
      const: o.value,
      title: o.value,
    }));
    onUpdateJsonSchema({ oneOf: oneOfValues });
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

  const handleAddOption = () => {
    shouldFocusNewRef.current = true;
    updateOptions([...options, { id: crypto.randomUUID(), value: '' }]);
  };

  const handleUpdateOption = (id: string, value: string) => {
    updateOptions(
      options.map((opt) => (opt.id === id ? { ...opt, value } : opt)),
    );
  };

  const handleRemoveOption = (id: string) => {
    updateOptions(options.filter((opt) => opt.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent, option: DropdownOption) => {
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
        renderDragPreview={(items) => {
          const item = items[0];
          if (!item) {
            return null;
          }
          return (
            <div className="flex items-center gap-2">
              <LuGripVertical className="size-4 text-neutral-gray3" />
              <span className="mr-12 grow rounded-lg border border-neutral-gray2 bg-white px-4 py-3 text-neutral-charcoal shadow-lg">
                {item.value || t('Option')}
              </span>
            </div>
          );
        }}
        className="gap-2"
        aria-label={t('Dropdown options')}
      >
        {(option, controls) => {
          const index = options.findIndex((o) => o.id === option.id);
          return (
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
          );
        }}
      </Sortable>

      <Button
        color="ghost"
        size="small"
        onPress={handleAddOption}
        className="hover:text-primary-tealDark gap-1 p-0 text-primary-teal"
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
  const Icon = getCriterionIcon(criterion.criterionType);
  return <FieldConfigCardDragPreview icon={Icon} label={criterion.label} />;
}

export function RubricCriterionDropIndicator() {
  return (
    <div className="flex h-12 items-center gap-2 rounded-lg border bg-neutral-offWhite" />
  );
}
