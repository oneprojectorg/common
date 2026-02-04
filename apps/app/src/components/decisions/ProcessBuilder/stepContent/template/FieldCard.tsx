'use client';

import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionIndicator,
  AccordionItem,
  AccordionTrigger,
} from '@op/ui/Accordion';
import { Button } from '@op/ui/Button';
import { Input } from '@op/ui/Field';
import { DragHandle } from '@op/ui/Sortable';
import type { SortableItemControls } from '@op/ui/Sortable';
import { cn } from '@op/ui/utils';
import { LuGripVertical, LuLock, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { FieldConfigDropdown } from './FieldConfigDropdown';
import { FieldPreview } from './FieldPreview';
import type { FormField } from './types';

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
 * Check if a field type has configuration options.
 */
function hasConfigOptions(type: FormField['type']): boolean {
  return type === 'dropdown';
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

  // Locked fields render as static cards
  if (field.locked) {
    return (
      <div
        data-field-id={field.id}
        className="flex flex-col gap-2 rounded-lg border bg-neutral-offWhite p-4"
      >
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center text-neutral-gray4">
            <LuLock size={16} />
          </div>
          <span className="flex-1 font-medium text-neutral-charcoal">
            {field.label}
          </span>
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
      data-field-id={field.id}
      className={cn(
        'rounded-lg border bg-white p-4',
        isDragging && 'opacity-50',
      )}
    >
      {/* Header: drag handle, label input, remove button */}
      <div className="flex items-center gap-2">
        {controls && (
          <DragHandle
            {...controls.dragHandleProps}
            aria-label={t('Drag to reorder {field}', { field: field.label })}
          />
        )}
        <Input
          type="text"
          value={field.label}
          onChange={(e) => onUpdate?.(field.id, { label: e.target.value })}
          className={cn(
            'h-auto flex-1 rounded-none border-x-0 border-t-0 border-b-1 border-transparent px-0 py-2 font-medium text-neutral-charcoal',
            'focus:border-primary-teal focus:bg-white',
          )}
        />
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

      {/* Field preview */}
      <div className="mt-3 px-6">
        <FieldPreview field={field} />
      </div>

      {/* Configuration accordion (only for field types with config options) */}
      {hasConfigOptions(field.type) && (
        <Accordion className="mt-3" variant="unstyled">
          <AccordionItem id="config">
            <AccordionHeader className="flex items-center gap-2 border-t pt-3">
              <AccordionTrigger className="flex items-center gap-2 text-sm text-neutral-gray4 hover:text-neutral-charcoal">
                <AccordionIndicator />
                <span>{t('Options')}</span>
              </AccordionTrigger>
            </AccordionHeader>
            <AccordionContent>
              <div className="pt-3">
                {field.type === 'dropdown' && (
                  <FieldConfigDropdown
                    options={field.options ?? []}
                    onOptionsChange={(options) =>
                      onUpdate?.(field.id, { options })
                    }
                  />
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
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
    <div className="h-16 rounded-lg border-2 border-dashed border-neutral-gray3 bg-neutral-offWhite" />
  );
}
