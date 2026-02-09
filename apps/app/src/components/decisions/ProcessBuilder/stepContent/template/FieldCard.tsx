'use client';

import {
  FieldConfigCard,
  FieldConfigCardDragPreview,
} from '@op/ui/FieldConfigCard';
import type { SortableItemControls } from '@op/ui/Sortable';
import { ToggleButton } from '@op/ui/ToggleButton';

import { useTranslations } from '@/lib/i18n';

import {
  getFieldConfigComponent,
  getFieldIcon,
  getFieldLabelKey,
} from './fieldRegistry';
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
 * A card representing a form field in the builder.
 * For locked fields: shows lock icon, no drag handle or remove button
 * For sortable fields: uses FieldConfigCard with drag handle, remove button, and config section
 */
export function FieldCard({
  field,
  controls,
  onRemove,
  onUpdate,
}: FieldCardProps) {
  const t = useTranslations();

  const Icon = getFieldIcon(field.type);
  const ConfigComponent = getFieldConfigComponent(field.type);

  // Locked fields use the locked variant
  if (field.locked) {
    return (
      <FieldConfigCard
        icon={Icon}
        iconTooltip={t(getFieldLabelKey(field.type))}
        label={field.label}
        locked
      />
    );
  }

  // Sortable fields use the default variant
  return (
    <FieldConfigCard
      icon={Icon}
      iconTooltip={t(getFieldLabelKey(field.type))}
      label={field.label}
      onLabelChange={(label) => onUpdate?.(field.id, { label })}
      labelInputAriaLabel={t('Field label')}
      description={field.description}
      onDescriptionChange={(description) =>
        onUpdate?.(field.id, { description })
      }
      descriptionLabel={t('Description')}
      descriptionPlaceholder={t(
        'Provide additional guidance for participants...',
      )}
      onRemove={onRemove ? () => onRemove(field.id) : undefined}
      removeAriaLabel={t('Remove field')}
      dragHandleAriaLabel={t('Drag to reorder {field}', { field: field.label })}
      controls={controls}
    >
      {/* Field-specific config */}
      {ConfigComponent && (
        <div className="mt-4">
          <ConfigComponent
            field={field}
            onUpdate={(updates) => onUpdate?.(field.id, updates)}
          />
        </div>
      )}

      {/* Required toggle */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-neutral-charcoal">{t('Required?')}</span>
        <ToggleButton
          size="small"
          isSelected={field.required ?? false}
          onChange={(isSelected) =>
            onUpdate?.(field.id, { required: isSelected })
          }
          aria-label={t('Required')}
        />
      </div>
    </FieldConfigCard>
  );
}

/**
 * Drag preview shown while dragging a field card.
 */
export function FieldCardDragPreview({ field }: { field: FormField }) {
  const Icon = getFieldIcon(field.type);
  return <FieldConfigCardDragPreview icon={Icon} label={field.label} />;
}

/**
 * Drop indicator shown where a field will be placed.
 */
export function FieldCardDropIndicator() {
  return (
    <div className="flex h-12 items-center gap-2 rounded-lg border bg-neutral-offWhite" />
  );
}
