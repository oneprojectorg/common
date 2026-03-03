'use client';

import type { ReactNode } from 'react';
import { useRef } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { LuGripVertical, LuLock, LuX } from 'react-icons/lu';

import { cn } from '../lib/utils';
import { AutoSizeInput } from './AutoSizeInput';
import { Button } from './Button';
import { DragHandle } from './Sortable';
import type { SortableItemControls } from './Sortable';
import { TextField } from './TextField';
import { Tooltip, TooltipTrigger } from './Tooltip';

export interface FieldConfigCardProps {
  /** Icon component to display next to the label */
  icon: React.ComponentType<{ className?: string }>;
  /** Tooltip text for the icon */
  iconTooltip?: string;
  /** The editable label text */
  label: string;
  /** Callback when the label changes */
  onLabelChange?: (label: string) => void;
  /** Accessible label for the label input */
  labelInputAriaLabel?: string;
  /** Description text */
  description?: string;
  /** Callback when description changes */
  onDescriptionChange?: (description: string) => void;
  /** Label for the description field */
  descriptionLabel?: string;
  /** Placeholder for the description field */
  descriptionPlaceholder?: string;
  /** Callback when remove button is clicked */
  onRemove?: () => void;
  /** Accessible label for the remove button */
  removeAriaLabel?: string;
  /** Accessible label for the drag handle */
  dragHandleAriaLabel?: string;
  /** Sortable controls for drag-and-drop */
  controls?: SortableItemControls;
  /** Additional content to render below the description (config options, toggles, etc.) */
  children?: React.ReactNode;
  /** Additional class name for the card container */
  className?: string;
  /** Whether the card is locked (non-editable, no drag handle or remove button) */
  locked?: boolean;
}

/**
 * A configurable card component for form builders.
 * Features a header with drag handle, icon, editable label, and remove button,
 * plus an optional description field and slot for additional configuration.
 */
export function FieldConfigCard({
  icon: Icon,
  iconTooltip,
  label,
  onLabelChange,
  labelInputAriaLabel = 'Field label',
  description,
  onDescriptionChange,
  descriptionLabel = 'Description',
  descriptionPlaceholder,
  onRemove,
  removeAriaLabel = 'Remove field',
  dragHandleAriaLabel = 'Drag to reorder',
  controls,
  children,
  className,
  locked = false,
}: FieldConfigCardProps) {
  const isDragging = controls?.isDragging ?? false;
  const labelInputRef = useRef<HTMLInputElement>(null!);

  // Locked variant: static card with lock icon, no drag handle or remove button
  if (locked) {
    return (
      <div
        className={cn(
          'space-y-2 rounded-lg border bg-neutral-offWhite px-3 py-4',
          className,
        )}
      >
        <div className={cn('flex items-center gap-2', className)}>
          <div className="flex size-6 items-center justify-center text-neutral-gray4">
            <LuLock className="size-4" />
          </div>
          <TooltipTrigger>
            <AriaButton className="flex items-center text-neutral-gray4">
              <Icon className="size-4" />
            </AriaButton>
            {iconTooltip && <Tooltip>{iconTooltip}</Tooltip>}
          </TooltipTrigger>
          <span className="flex-1 text-neutral-charcoal">{label}</span>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border bg-white px-3 py-4',
        isDragging && 'opacity-50',
        className,
      )}
    >
      {/* Header: drag handle, icon, label input, remove button */}
      <div className="flex w-full items-center gap-2">
        <div className="flex min-w-0 grow items-center gap-2">
          {controls && (
            <DragHandle
              {...controls.dragHandleProps}
              aria-label={dragHandleAriaLabel}
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
              {iconTooltip && <Tooltip>{iconTooltip}</Tooltip>}
            </TooltipTrigger>
            <div className="min-w-0 overflow-hidden">
              <AutoSizeInput
                inputRef={labelInputRef}
                value={label}
                onChange={(value) => onLabelChange?.(value)}
                className="text-neutral-charcoal"
                aria-label={labelInputAriaLabel}
              />
            </div>
          </div>
        </div>
        {onRemove && (
          <Button
            color="ghost"
            size="small"
            aria-label={removeAriaLabel}
            onPress={onRemove}
            className="p-2 text-neutral-gray4 hover:text-neutral-charcoal"
          >
            <LuX className="size-4" />
          </Button>
        )}
      </div>

      {/* Body: description and custom config */}
      <div className="px-8">
        {/* Description field */}
        {onDescriptionChange && (
          <div className="mt-4">
            <TextField
              label={descriptionLabel}
              value={description ?? ''}
              onChange={onDescriptionChange}
              useTextArea
              textareaProps={{
                placeholder: descriptionPlaceholder,
                className: 'min-h-24 resize-none',
              }}
            />
          </div>
        )}

        {/* Additional config slot */}
        {children}
      </div>
    </div>
  );
}

export interface FieldConfigCardDragPreviewProps {
  /** Icon component to display next to the label */
  icon: React.ComponentType<{ className?: string }>;
  /** The label text */
  label: string;
  /** Optional custom content to override the default preview */
  children?: ReactNode;
  /** Additional class name for the preview container */
  className?: string;
}

/**
 * Drag preview shown while dragging a FieldConfigCard.
 * Shows a compact version with drag grip, icon, and label.
 */
export function FieldConfigCardDragPreview({
  icon: Icon,
  label,
  children,
  className,
}: FieldConfigCardDragPreviewProps) {
  if (children) {
    return (
      <div
        className={cn('rounded-lg border bg-white p-4 shadow-lg', className)}
      >
        {children}
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border bg-white p-4 shadow-lg', className)}>
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center text-neutral-gray4">
          <LuGripVertical className="size-4" />
        </div>
        <div className="flex min-w-0 items-center gap-2 rounded border border-neutral-gray1 bg-neutral-gray1 px-2 py-1">
          <Icon className="size-4 text-neutral-gray4" />
          <span className="text-neutral-charcoal">{label}</span>
        </div>
      </div>
    </div>
  );
}
