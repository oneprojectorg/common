'use client';

import type { FieldType } from '@op/common';
import {
  FieldConfigCard,
  FieldConfigCardDragPreview,
} from '@op/ui/FieldConfigCard';
import type { SortableItemControls } from '@op/ui/Sortable';
import { ToggleButton } from '@op/ui/ToggleButton';
import type { StrictRJSFSchema, UiSchema } from '@rjsf/utils';

import { useTranslations } from '@/lib/i18n';

import {
  getFieldConfigComponent,
  getFieldIcon,
  getFieldLabelKey,
} from './fieldRegistry';

interface FieldCardProps {
  fieldId: string;
  fieldSchema: StrictRJSFSchema;
  fieldUiSchema: UiSchema;
  fieldType: FieldType;
  isLocked: boolean;
  isRequired: boolean;
  controls?: SortableItemControls;
  onRemove?: (fieldId: string) => void;
  onUpdateLabel?: (fieldId: string, label: string) => void;
  onUpdateDescription?: (fieldId: string, description: string) => void;
  onUpdateRequired?: (fieldId: string, isRequired: boolean) => void;
  onUpdateJsonSchema?: (
    fieldId: string,
    updates: Partial<StrictRJSFSchema>,
  ) => void;
  onUpdateUiSchema?: (fieldId: string, updates: Partial<UiSchema>) => void;
}

/**
 * A card representing a form field in the builder.
 * For locked fields: shows lock icon, no drag handle or remove button
 * For sortable fields: uses FieldConfigCard with drag handle, remove button, and config section
 */
export function FieldCard({
  fieldId,
  fieldSchema,
  fieldUiSchema,
  fieldType,
  isLocked,
  isRequired,
  controls,
  onRemove,
  onUpdateLabel,
  onUpdateDescription,
  onUpdateRequired,
  onUpdateJsonSchema,
  onUpdateUiSchema,
}: FieldCardProps) {
  const t = useTranslations();

  const Icon = getFieldIcon(fieldType);
  const ConfigComponent = getFieldConfigComponent(fieldType);
  const label = (fieldSchema.title as string) ?? '';
  const description = fieldSchema.description;

  if (isLocked) {
    return (
      <FieldConfigCard
        icon={Icon}
        iconTooltip={t(getFieldLabelKey(fieldType))}
        label={label}
        locked
      />
    );
  }

  return (
    <FieldConfigCard
      icon={Icon}
      iconTooltip={t(getFieldLabelKey(fieldType))}
      label={label}
      onLabelChange={(newLabel) => onUpdateLabel?.(fieldId, newLabel)}
      labelInputAriaLabel={t('Field label')}
      description={description}
      onDescriptionChange={(desc) => onUpdateDescription?.(fieldId, desc)}
      descriptionLabel={t('Description')}
      descriptionPlaceholder={t(
        'Provide additional guidance for participants...',
      )}
      onRemove={onRemove ? () => onRemove(fieldId) : undefined}
      removeAriaLabel={t('Remove field')}
      dragHandleAriaLabel={t('Drag to reorder {field}', { field: label })}
      controls={controls}
    >
      {ConfigComponent && (
        <div className="mt-4">
          <ConfigComponent
            fieldId={fieldId}
            fieldSchema={fieldSchema}
            fieldUiSchema={fieldUiSchema}
            onUpdateJsonSchema={(updates) =>
              onUpdateJsonSchema?.(fieldId, updates)
            }
            onUpdateUiSchema={(updates) => onUpdateUiSchema?.(fieldId, updates)}
          />
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <span className="text-neutral-charcoal">{t('Required?')}</span>
        <ToggleButton
          size="small"
          isSelected={isRequired}
          onChange={(isSelected) => onUpdateRequired?.(fieldId, isSelected)}
          aria-label={t('Required')}
        />
      </div>
    </FieldConfigCard>
  );
}

/**
 * Drag preview shown while dragging a field card.
 */
export function FieldCardDragPreview({
  fieldType,
  label,
}: {
  fieldType: FieldType;
  label: string;
}) {
  const Icon = getFieldIcon(fieldType);
  return <FieldConfigCardDragPreview icon={Icon} label={label} />;
}

/**
 * Drop indicator shown where a field will be placed.
 */
export function FieldCardDropIndicator() {
  return (
    <div className="flex h-12 items-center gap-2 rounded-lg border bg-neutral-offWhite" />
  );
}
