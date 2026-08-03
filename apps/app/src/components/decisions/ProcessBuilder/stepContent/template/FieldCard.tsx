'use client';

import type { XFormatPropertySchema } from '@op/common/client';
import { Button } from '@op/sense/Button';
import {
  CollapsibleConfigCard,
  CollapsibleConfigCardDragPreview,
} from '@op/sense/CollapsibleConfigCard';
import { Field, FieldLabel } from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from '@op/sense/InputGroup';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import type { SortableItemControls } from '@op/sense/Sortable';
import { Switch } from '@op/sense/Switch';
import { cn } from '@op/sense/lib/utils';
import type { Key } from 'react';
import { useEffect, useRef, useId } from 'react';
import { LuTrash2 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n';

import type { FieldType, FieldView } from '../../../proposalTemplate';
import {
  FIELD_CATEGORIES,
  FIELD_TYPE_REGISTRY,
  getFieldConfigComponent,
  getFieldIcon,
} from './fieldRegistry';

interface FieldCardProps {
  field: FieldView;
  fieldSchema: XFormatPropertySchema;
  errors?: string[];
  controls: SortableItemControls;
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
  isNew?: boolean;
  onNewComplete?: (fieldId: string) => void;
}

const DESCRIPTION_MAX_LENGTH = 250;

// Location is excluded: it's single-instance with a fixed key, so existing
// fields can't switch to it (and it can't switch away).
const FIELD_TYPE_OPTIONS = FIELD_CATEGORIES.flatMap((category) =>
  category.types.map((type) => ({
    type,
    labelKey: FIELD_TYPE_REGISTRY[type].labelKey,
  })),
).filter((option) => option.type !== 'location');

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
  isNew,
  onNewComplete,
}: FieldCardProps) {
  const t = useTranslations();
  const cardRef = useRef<HTMLDivElement>(null);
  const fieldNameRef = useRef<HTMLInputElement>(null);
  const requiredToggleId = useId();

  // Scroll newly added fields into view and auto-focus the name input
  useEffect(() => {
    if (isNew) {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      fieldNameRef.current?.focus({ preventScroll: true });
      fieldNameRef.current?.select();
    }
  }, [isNew]);

  const ConfigComponent = getFieldConfigComponent(field.fieldType);
  const isLocation = field.fieldType === 'location';

  const fieldNameId = `field-name-${field.id}`;
  const fieldTypeId = `field-type-${field.id}`;
  const fieldDescId = `field-description-${field.id}`;

  // value → label map so base-ui `SelectValue` shows the type label, not the
  // raw stored type key.
  const typeItems = Object.fromEntries(
    FIELD_TYPE_OPTIONS.map((opt) => [opt.type, t(opt.labelKey)]),
  );

  // Only trigger validation when focus leaves the card entirely,
  // not when moving between inputs within the card.
  const handleBlur = (e: React.FocusEvent) => {
    if (cardRef.current && !cardRef.current.contains(e.relatedTarget as Node)) {
      onBlur?.(field.id);
    }
  };

  const handleTypeChange = (key: Key | null) => {
    if (key === null) {
      return;
    }
    onChangeFieldType?.(field.id, key as FieldType);
  };

  const displayLabel = field.label || t('Untitled field');
  const badgeLabel = field.required ? t('Required') : t('Optional');

  return (
    <div
      ref={cardRef}
      onBlur={handleBlur}
      // Clear "new" state after the teal border highlight animation finishes
      onAnimationEnd={() => onNewComplete?.(field.id)}
      className="scroll-m-6"
    >
      <CollapsibleConfigCard
        label={displayLabel}
        badgeLabel={badgeLabel}
        isCollapsible
        isExpanded={isExpanded}
        onExpandedChange={onExpandedChange}
        controls={controls}
        dragHandleAriaLabel={t('Drag to reorder {field}', {
          field: displayLabel,
        })}
        className={cn(
          isNew && 'animate-border-highlight',
          errors.length > 0 && 'border-functional-red',
        )}
      >
        {/* Field name + Type selector row */}
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start">
          <Field className="min-w-0 flex-1">
            <FieldLabel htmlFor={fieldNameId}>
              {t('Field name')}
              <RequiredAsterisk />
            </FieldLabel>
            <Input
              ref={fieldNameRef}
              id={fieldNameId}
              value={field.label}
              onChange={(e) => onUpdateLabel?.(field.id, e.target.value)}
              maxLength={50}
              required
              aria-required
              className="bg-white [unicode-bidi:plaintext]"
            />
          </Field>
          {!isLocation && (
            <Field className="w-40">
              <FieldLabel htmlFor={fieldTypeId}>{t('Type')}</FieldLabel>
              <Select
                value={field.fieldType}
                onValueChange={(value) => handleTypeChange(value)}
                items={typeItems}
              >
                <SelectTrigger id={fieldTypeId} className="w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.type} value={opt.type}>
                      {t(opt.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>

        {/* Description */}
        <Field>
          <FieldLabel htmlFor={fieldDescId}>{t('Description')}</FieldLabel>
          <InputGroup className="bg-white">
            <InputGroupTextarea
              id={fieldDescId}
              value={field.description ?? ''}
              onChange={(e) => onUpdateDescription?.(field.id, e.target.value)}
              maxLength={DESCRIPTION_MAX_LENGTH}
              placeholder={t('Provide additional guidance for participants...')}
              className="min-h-16 [unicode-bidi:plaintext]"
            />
            <InputGroupAddon align="block-end" className="justify-end">
              {t('{count}/{max}', {
                count: field.description?.length ?? 0,
                max: DESCRIPTION_MAX_LENGTH,
              })}
            </InputGroupAddon>
          </InputGroup>
        </Field>

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
        <div className="flex items-center justify-between gap-4 border-t pt-4">
          <Field orientation="horizontal" className="w-auto">
            <FieldLabel
              className="text-neutral-charcoal"
              htmlFor={requiredToggleId}
            >
              {t('Required?')}
            </FieldLabel>
            <Switch
              id={requiredToggleId}
              checked={isLocation || field.required}
              disabled={isLocation}
              onCheckedChange={(isSelected) =>
                onUpdateRequired?.(field.id, isSelected)
              }
              aria-label={t('Required')}
            />
          </Field>
          {onRemove && (
            <Button
              variant="destructive"
              onClick={() => onRemove(field.id)}
              aria-label={t('Delete')}
            >
              <LuTrash2 className="size-4" />
              {t('Delete')}
            </Button>
          )}
        </div>
      </CollapsibleConfigCard>
    </div>
  );
}

/**
 * Drag preview shown while dragging a field card.
 */
export function FieldCardDragPreview({ field }: { field: FieldView }) {
  const t = useTranslations();
  const Icon = getFieldIcon(field.fieldType);
  return (
    <CollapsibleConfigCardDragPreview
      icon={Icon}
      label={field.label}
      badgeLabel={field.required ? t('Required') : t('Optional')}
    />
  );
}

/**
 * Drop indicator shown where a field will be placed.
 */
export function FieldCardDropIndicator() {
  return <div className="h-16 rounded-lg border bg-neutral-offWhite" />;
}
