'use client';

import type { XFormatPropertySchema } from '@op/common/client';
import { Button } from '@op/ui/Button';
import {
  CollapsibleConfigCard,
  CollapsibleConfigCardDragPreview,
} from '@op/ui/CollapsibleConfigCard';
import { Select, SelectItem } from '@op/ui/Select';
import type { SortableItemControls } from '@op/ui/Sortable';
import { TextField } from '@op/ui/TextField';
import { ToggleButton } from '@op/ui/ToggleButton';
import type { Key } from 'react';
import { useRef } from 'react';
import { LuTrash2 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n';

import type { FieldType, FieldView } from '../../../proposalTemplate';
import {
  FIELD_TYPE_REGISTRY,
  getFieldConfigComponent,
  getFieldIcon,
} from './fieldRegistry';

interface FieldCardProps {
  field: FieldView;
  fieldSchema: XFormatPropertySchema;
  errors?: string[];
  controls?: SortableItemControls;
  isExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onRemove?: (fieldId: string) => void;
  onBlur?: (fieldId: string) => void;
  onUpdateLabel?: (fieldId: string, label: string) => void;
  onUpdateDescription?: (fieldId: string, description: string) => void;
  onUpdateRequired?: (fieldId: string, isRequired: boolean) => void;
  onUpdateJsonSchema?: (
    fieldId: string,
    updates: Partial<XFormatPropertySchema>,
  ) => void;
  onChangeFieldType?: (fieldId: string, newType: FieldType) => void;
}

const FIELD_TYPE_OPTIONS = (
  Object.entries(FIELD_TYPE_REGISTRY) as [
    FieldType,
    (typeof FIELD_TYPE_REGISTRY)[FieldType],
  ][]
).map(([type, entry]) => ({
  type,
  labelKey: entry.labelKey,
}));

/**
 * A collapsible card representing a form field in the builder.
 * Uses CollapsibleConfigCard with drag handle, type selector, and config section.
 */
export function FieldCard({
  field,
  fieldSchema,
  errors = [],
  controls,
  isExpanded,
  onExpandedChange,
  onRemove,
  onBlur,
  onUpdateLabel,
  onUpdateDescription,
  onUpdateRequired,
  onUpdateJsonSchema,
  onChangeFieldType,
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

  const handleTypeChange = (key: Key) => {
    onChangeFieldType?.(field.id, key as FieldType);
  };

  const displayLabel = field.label || t('Untitled field');
  const badgeLabel = field.required ? t('Required') : t('Optional');

  return (
    <div ref={cardRef} onBlur={handleBlur}>
      <CollapsibleConfigCard
        icon={Icon}
        label={displayLabel}
        badgeLabel={badgeLabel}
        isCollapsible
        isExpanded={isExpanded}
        onExpandedChange={onExpandedChange}
        controls={controls}
        dragHandleAriaLabel={t('Drag to reorder {field}', {
          field: field.label,
        })}
        className={errors.length > 0 ? 'border-functional-red' : undefined}
      >
        <div className="space-y-4 px-8">
          {/* Field name + Type selector row */}
          <div className="flex items-start gap-3">
            <TextField
              label={t('Field name')}
              value={field.label}
              onChange={(value) => onUpdateLabel?.(field.id, value)}
              maxLength={50}
              inputProps={{
                className: 'bg-white',
              }}
              className="min-w-0 flex-1"
              isRequired
              description={`${field.label.length}/50`}
            />
            <Select
              label={t('Type')}
              selectedKey={field.fieldType}
              onSelectionChange={handleTypeChange}
              buttonClassName="bg-white"
              className="w-40"
            >
              {FIELD_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.type} id={opt.type}>
                  {t(opt.labelKey)}
                </SelectItem>
              ))}
            </Select>
          </div>

          {/* Description */}
          <TextField
            label={t('Description')}
            value={field.description ?? ''}
            onChange={(desc) => onUpdateDescription?.(field.id, desc)}
            useTextArea
            textareaProps={{
              placeholder: t('Provide additional guidance for participants...'),
              className: 'min-h-24 resize-none bg-white',
            }}
          />

          {/* Type-specific config */}
          {ConfigComponent && (
            <ConfigComponent
              field={field}
              fieldSchema={fieldSchema}
              onUpdateJsonSchema={(updates) =>
                onUpdateJsonSchema?.(field.id, updates)
              }
            />
          )}

          {/* Validation errors */}
          {errors.length > 0 && (
            <div className="space-y-1">
              {errors.map((error) => (
                <p key={error} className="text-functional-red">
                  {t(error as TranslationKey)}
                </p>
              ))}
            </div>
          )}

          {/* Footer: Required toggle + Delete button */}
          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-2">
              <span className="text-neutral-charcoal">{t('Required?')}</span>
              <ToggleButton
                size="small"
                isSelected={field.required}
                onChange={(isSelected) =>
                  onUpdateRequired?.(field.id, isSelected)
                }
                aria-label={t('Required')}
              />
            </div>
            {onRemove && (
              <Button
                color="ghost"
                size="small"
                onPress={() => onRemove(field.id)}
                aria-label={t('Delete')}
                className="text-neutral-gray4 hover:text-functional-red"
              >
                <LuTrash2 className="size-4" />
                {t('Delete')}
              </Button>
            )}
          </div>
        </div>
      </CollapsibleConfigCard>
    </div>
  );
}

/**
 * Drag preview shown while dragging a field card.
 */
export function FieldCardDragPreview({ field }: { field: FieldView }) {
  const Icon = getFieldIcon(field.fieldType);
  return <CollapsibleConfigCardDragPreview icon={Icon} label={field.label} />;
}

/**
 * Drop indicator shown where a field will be placed.
 */
export function FieldCardDropIndicator() {
  return (
    <div className="flex h-12 items-center gap-2 rounded-lg border bg-neutral-offWhite" />
  );
}
