'use client';

import { AutoSizeInput } from '@op/ui/AutoSizeInput';
import { Button } from '@op/ui/Button';
import { Button as AriaButton } from '@op/ui/RAC';
import { DragHandle } from '@op/ui/Sortable';
import type { SortableItemControls } from '@op/ui/Sortable';
import { TextField } from '@op/ui/TextField';
import { ToggleButton } from '@op/ui/ToggleButton';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { cn } from '@op/ui/utils';
import { useRef } from 'react';
import { LuGripVertical, LuLock, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { FieldConfigDropdown } from './FieldConfigDropdown';
import { getFieldIcon, getFieldLabelKey } from './fieldRegistry';
import type { FormField } from './types';

/** Field types that have dropdown/choice options */
const FIELD_TYPES_WITH_OPTIONS: FormField['type'][] = [
  'dropdown',
  'multiple_choice',
];

interface FieldCardProps {
  field: FormField;
  /** Sortable controls - only required for non-locked fields */
  controls?: SortableItemControls;
  /** Remove handler - only required for non-locked fields */
  onRemove?: (fieldId: string) => void;
  /** Update handler for field changes */
  onUpdate?: (fieldId: string, updates: Partial<FormField>) => void;
}

/**
 * A card representing a form field in the builder.
 * For locked fields: shows lock icon, no drag handle or remove button
 * For sortable fields: shows drag handle, remove button, and expandable config section
 */
export function FieldCard({
  field,
  controls,
  onRemove,
  onUpdate,
}: FieldCardProps) {
  const t = useTranslations();
  const isDragging = controls?.isDragging ?? false;
  const labelInputRef = useRef<HTMLInputElement>(null!);

  const Icon = getFieldIcon(field.type);

  // Locked fields render as static cards
  if (field.locked) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-neutral-offWhite p-4">
        <div className="flex size-6 items-center justify-center text-neutral-gray4">
          <LuLock className="size-4" />
        </div>
        <TooltipTrigger>
          <AriaButton className="flex items-center text-neutral-gray4">
            <Icon className="size-4" />
          </AriaButton>
          <Tooltip>{t(getFieldLabelKey(field.type))}</Tooltip>
        </TooltipTrigger>

        <span className="flex-1 text-neutral-charcoal">{field.label}</span>
      </div>
    );
  }

  // Sortable fields with config for each field

  return (
    <div
      className={cn(
        'rounded-lg border bg-white px-3 py-4',
        isDragging && 'opacity-50',
      )}
    >
      {/* Header: drag handle, icon, label input, remove button */}
      <div className="flex w-full items-center gap-2">
        <div className="flex min-w-0 grow items-center gap-2">
          {controls && (
            <DragHandle
              {...controls.dragHandleProps}
              aria-label={t('Drag to reorder {field}', { field: field.label })}
            />
          )}
          <div className="flex min-w-0 items-center gap-2 rounded border border-neutral-gray1 bg-neutral-gray1 px-2 py-1 focus-within:border-neutral-gray2 focus-within:bg-white">
            <TooltipTrigger>
              <AriaButton
                className="flex shrink-0 items-center text-neutral-gray4"
                onPress={() => labelInputRef.current?.focus()}
              >
                <Icon className="size-4" />
              </AriaButton>
              <Tooltip>{t(getFieldLabelKey(field.type))}</Tooltip>
            </TooltipTrigger>
            <div className="min-w-0 overflow-hidden">
              <AutoSizeInput
                inputRef={labelInputRef}
                value={field.label}
                onChange={(label) => onUpdate?.(field.id, { label })}
                className="text-neutral-charcoal"
                aria-label={t('Field label')}
              />
            </div>
          </div>
        </div>
        {onRemove && (
          <Button
            color="ghost"
            size="small"
            aria-label={t('Remove field')}
            onPress={() => onRemove(field.id)}
            className="p-2 text-neutral-gray4 hover:text-neutral-charcoal"
          >
            <LuX className="size-4" />
          </Button>
        )}
      </div>
      <div className="px-8">
        {/* Description field */}
        <div className="mt-4">
          <TextField
            label={t('Description')}
            value={field.description ?? ''}
            onChange={(value) => onUpdate?.(field.id, { description: value })}
            useTextArea
            textareaProps={{
              placeholder: t('Provide additional guidance for participants...'),
              className: 'min-h-24 resize-none',
            }}
          />
        </div>

        {/* Options section (for dropdown/multiple choice fields) */}
        {FIELD_TYPES_WITH_OPTIONS.includes(field.type) && (
          <div className="mt-4">
            <FieldConfigDropdown
              options={field.options ?? []}
              onOptionsChange={(options) => onUpdate?.(field.id, { options })}
            />
          </div>
        )}

        {/* Required toggle */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-neutral-charcoal">
            {t('Required?')}
          </span>
          <ToggleButton
            size="small"
            isSelected={field.required ?? false}
            onChange={(isSelected) =>
              onUpdate?.(field.id, { required: isSelected })
            }
            aria-label={t('Required')}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Drag preview shown while dragging a field card.
 */
export function FieldCardDragPreview({ field }: { field: FormField }) {
  const Icon = getFieldIcon(field.type);
  return (
    <div className="rounded-lg border bg-white p-4 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center text-neutral-gray4">
          <LuGripVertical className="size-4" />
        </div>
        <div className="flex min-w-0 items-center gap-2 rounded border border-neutral-gray1 bg-neutral-gray1 px-2 py-1">
          <Icon className="size-4 text-neutral-gray4" />
          <span className="text-neutral-charcoal">{field.label}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Drop indicator shown where a field will be placed.
 */
export function FieldCardDropIndicator() {
  return (
    <div className="flex h-12 items-center gap-2 rounded-lg border bg-neutral-offWhite" />
  );
}
