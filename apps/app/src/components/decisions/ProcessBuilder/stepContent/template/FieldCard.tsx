'use client';

import { Button } from '@op/ui/Button';
import { DragHandle } from '@op/ui/Sortable';
import type { SortableItemControls } from '@op/ui/Sortable';
import { TextField } from '@op/ui/TextField';
import { ToggleButton } from '@op/ui/ToggleButton';
import { Tooltip, TooltipTrigger } from '@op/ui/Tooltip';
import { cn } from '@op/ui/utils';
import { useEffect, useRef, useState } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { LuGripVertical, LuLock, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { FieldConfigDropdown } from './FieldConfigDropdown';
import { FieldPreview } from './FieldPreview';
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
 * Input that automatically resizes based on its content.
 */
function AutoSizeInput({
  value,
  onChange,
  className,
  inputRef,
  minWidth = 30,
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement>;
  minWidth?: number;
  'aria-label': string;
}) {
  const measureRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(minWidth);

  useEffect(() => {
    if (measureRef.current) {
      const measuredWidth = measureRef.current.offsetWidth;
      setWidth(Math.max(minWidth, measuredWidth + 4)); // +4 for cursor space
    }
  }, [value, minWidth]);

  return (
    <div className="relative inline-block">
      {/* Hidden span to measure text width */}
      <span
        ref={measureRef}
        className={cn(className, 'invisible absolute whitespace-pre')}
        aria-hidden="true"
      >
        {value || ''}
      </span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(className, 'border-none bg-transparent outline-none')}
        style={{ width }}
        aria-label={ariaLabel}
      />
    </div>
  );
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
      <div className="flex flex-col gap-2 rounded-lg border bg-neutral-offWhite p-4">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center text-neutral-gray4">
            <LuLock size={16} />
          </div>
          <TooltipTrigger>
            <AriaButton className="flex items-center text-neutral-gray4">
              <Icon size={16} />
            </AriaButton>
            <Tooltip>{t(getFieldLabelKey(field.type))}</Tooltip>
          </TooltipTrigger>

          <span className="flex-1 text-neutral-charcoal">{field.label}</span>
        </div>
        <div className="px-6">
          <FieldPreview field={field} />
        </div>
      </div>
    );
  }

  // Sortable fields with internal accordion for config

  return (
    <div
      className={cn(
        'rounded-lg border bg-white p-4',
        isDragging && 'opacity-50',
      )}
    >
      {/* Header: drag handle, icon, label input, remove button */}
      <div className="flex items-center gap-2">
        <div className="flex grow items-center gap-2">
          {controls && (
            <DragHandle
              {...controls.dragHandleProps}
              aria-label={t('Drag to reorder {field}', { field: field.label })}
            />
          )}
          <div className="flex shrink items-center gap-2 rounded border border-neutral-gray1 bg-neutral-gray1 px-2 py-1 focus-within:border-neutral-gray2 focus-within:bg-white">
            <TooltipTrigger>
              <AriaButton
                className="flex items-center text-neutral-gray4"
                onPress={() => labelInputRef.current?.focus()}
              >
                <Icon size={16} />
              </AriaButton>
              <Tooltip>{t(getFieldLabelKey(field.type))}</Tooltip>
            </TooltipTrigger>
            <AutoSizeInput
              inputRef={labelInputRef}
              value={field.label}
              onChange={(label) => onUpdate?.(field.id, { label })}
              className="text-neutral-charcoal"
              aria-label={t('Field label')}
            />
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
            <LuX size={16} />
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
  return (
    <div className="rounded-lg border bg-white p-4 shadow-lg">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center text-neutral-gray4">
          <LuGripVertical size={16} />
        </div>
        <span className="font-medium text-neutral-charcoal">{field.label}</span>
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
