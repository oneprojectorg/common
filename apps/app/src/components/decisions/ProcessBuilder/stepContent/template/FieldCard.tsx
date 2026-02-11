'use client';

import {
  FieldConfigCard,
  FieldConfigCardDragPreview,
} from '@op/ui/FieldConfigCard';
import type { SortableItemControls } from '@op/ui/Sortable';
import { ToggleButton } from '@op/ui/ToggleButton';
import type { RJSFSchema } from '@rjsf/utils';
import { useRef } from 'react';

import { useTranslations } from '@/lib/i18n';

import type { FieldView } from '../../../proposalTemplate';
import {
  getFieldConfigComponent,
  getFieldIcon,
  getFieldLabelKey,
} from './fieldRegistry';

interface FieldCardProps {
  field: FieldView;
  fieldSchema: RJSFSchema;
  errors?: string[];
  controls?: SortableItemControls;
  onRemove?: (fieldId: string) => void;
  onBlur?: (fieldId: string) => void;
  onUpdateLabel?: (fieldId: string, label: string) => void;
  onUpdateDescription?: (fieldId: string, description: string) => void;
  onUpdateRequired?: (fieldId: string, isRequired: boolean) => void;
  onUpdateJsonSchema?: (fieldId: string, updates: Partial<RJSFSchema>) => void;
}

/**
 * A card representing a form field in the builder.
 * Uses FieldConfigCard with drag handle, remove button, and config section.
 */
export function FieldCard({
  field,
  fieldSchema,
  errors = [],
  controls,
  onRemove,
  onBlur,
  onUpdateLabel,
  onUpdateDescription,
  onUpdateRequired,
  onUpdateJsonSchema,
}: FieldCardProps) {
  const t = useTranslations();
  const cardRef = useRef<HTMLDivElement>(null);

  const Icon = getFieldIcon(field.fieldType);
  const ConfigComponent = getFieldConfigComponent(field.fieldType);

  const handleBlur = (e: React.FocusEvent) => {
    if (cardRef.current && !cardRef.current.contains(e.relatedTarget as Node)) {
      onBlur?.(field.id);
    }
  };

  return (
    <div ref={cardRef} onBlur={handleBlur}>
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
        className={errors.length > 0 ? 'border-functional-red' : undefined}
      >
        {ConfigComponent && (
          <div className="mt-4">
            <ConfigComponent
              field={field}
              fieldSchema={fieldSchema}
              onUpdateJsonSchema={(updates) =>
                onUpdateJsonSchema?.(field.id, updates)
              }
            />
          </div>
        )}

        {errors.length > 0 && (
          <div className="mt-4 space-y-1">
            {errors.map((error) => (
              <p key={error} className="text-functional-red">
                {t(error)}
              </p>
            ))}
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
    </div>
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
