import { Button } from '@op/ui/Button';
import { DragHandle } from '@op/ui/Sortable';
import type { SortableItemControls } from '@op/ui/Sortable';
import { cn } from '@op/ui/utils';
import { LuGripVertical, LuLock, LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { FieldPreview } from './FieldPreview';
import type { FormField } from './types';

interface FieldCardProps {
  field: FormField;
  /** Sortable controls - only required for non-locked fields */
  controls?: SortableItemControls;
  /** Remove handler - only required for non-locked fields */
  onRemove?: (fieldId: string) => void;
}

/**
 * A card representing a form field in the builder.
 * For locked fields: shows lock icon, no drag handle or remove button
 * For sortable fields: shows drag handle and remove button
 */
export function FieldCard({ field, controls, onRemove }: FieldCardProps) {
  const t = useTranslations();
  const isDragging = controls?.isDragging ?? false;

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border p-4',
        isDragging && 'opacity-50',
        field.locked ? 'bg-neutral-offWhite' : 'bg-white',
      )}
    >
      {/* Header with drag handle/lock and field label */}
      <div className="flex items-center gap-2">
        {field.locked ? (
          <div className="flex size-6 items-center justify-center text-neutral-gray4">
            <LuLock size={16} />
          </div>
        ) : (
          controls && (
            <DragHandle
              {...controls.dragHandleProps}
              aria-label={t('Drag to reorder {field}', { field: field.label })}
            />
          )
        )}

        <span className="flex-1 font-medium text-neutral-charcoal">
          {field.label}
        </span>

        {!field.locked && onRemove && (
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
      <div className="px-6">
        <FieldPreview field={field} />
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
    <div className="h-16 rounded-lg border-2 border-dashed border-neutral-gray3 bg-neutral-offWhite" />
  );
}
