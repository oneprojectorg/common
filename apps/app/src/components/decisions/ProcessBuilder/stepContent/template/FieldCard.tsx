'use client';

import {
  FieldConfigCard,
  FieldConfigCardDragPreview,
} from '@op/ui/FieldConfigCard';
import type { SortableItemControls } from '@op/ui/Sortable';
import { ToggleButton } from '@op/ui/ToggleButton';
import type { StrictRJSFSchema, UiSchema } from '@rjsf/utils';

import { useTranslations } from '@/lib/i18n';

import type { FieldView } from '../../../proposalTemplate';
import {
  getFieldConfigComponent,
  getFieldIcon,
  getFieldLabelKey,
} from './fieldRegistry';

interface FieldCardProps {
  field: FieldView;
  fieldSchema: StrictRJSFSchema;
  fieldUiSchema: UiSchema;
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
  field,
  fieldSchema,
  fieldUiSchema,
  controls,
  onRemove,
  onUpdateLabel,
  onUpdateDescription,
  onUpdateRequired,
  onUpdateJsonSchema,
  onUpdateUiSchema,
}: FieldCardProps) {
  const t = useTranslations();

  const Icon = getFieldIcon(field.fieldType);
  const ConfigComponent = getFieldConfigComponent(field.fieldType);

  if (field.locked) {
    return (
      <FieldConfigCard
        icon={Icon}
        iconTooltip={t(getFieldLabelKey(field.fieldType))}
        label={field.label}
        locked
      />
    );
  }

  return (
    <FieldConfigCard
      icon={Icon}
      iconTooltip={t(getFieldLabelKey(field.fieldType))}
      label={field.label}
      onLabelChange={(newLabel) => onUpdateLabel?.(field.id, newLabel)}
      labelInputAriaLabel={t('Field label')}
      description={field.description}
      onDescriptionChange={(desc) => onUpdateDescription?.(field.id, desc)}
      descriptionLabel={t('Description')}
      descriptionPlaceholder={t(
        'Provide additional guidance for participants...',
      )}
      onRemove={onRemove ? () => onRemove(field.id) : undefined}
      removeAriaLabel={t('Remove field')}
      dragHandleAriaLabel={t('Drag to reorder {field}', {
        field: field.label,
      })}
      controls={controls}
    >
      {ConfigComponent && (
        <div className="mt-4">
          <ConfigComponent
            field={field}
            fieldSchema={fieldSchema}
            fieldUiSchema={fieldUiSchema}
            onUpdateJsonSchema={(updates) =>
              onUpdateJsonSchema?.(field.id, updates)
            }
            onUpdateUiSchema={(updates) =>
              onUpdateUiSchema?.(field.id, updates)
            }
          />
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <span className="text-neutral-charcoal">{t('Required?')}</span>
        <ToggleButton
          size="small"
          isSelected={field.required}
          onChange={(isSelected) => onUpdateRequired?.(field.id, isSelected)}
          aria-label={t('Required')}
        />
      </div>
    </FieldConfigCard>
  );
}

/**
 * Drag preview shown while dragging a field card.
 */
export function FieldCardDragPreview({ field }: { field: FieldView }) {
  const Icon = getFieldIcon(field.fieldType);
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
