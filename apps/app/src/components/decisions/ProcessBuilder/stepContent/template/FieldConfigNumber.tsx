'use client';

import { NumberField } from '@op/ui/NumberField';
import { ToggleButton } from '@op/ui/ToggleButton';

import { useTranslations } from '@/lib/i18n';

import type { FieldConfigProps } from './fieldRegistry';

/**
 * Field config component for number fields.
 * Allows setting min/max constraints and currency mode.
 */
export function FieldConfigNumber({
  fieldSchema,
  fieldUiSchema,
  onUpdateJsonSchema,
  onUpdateUiSchema,
}: FieldConfigProps) {
  const t = useTranslations();

  const min = fieldSchema.minimum ?? null;
  const max = fieldSchema.maximum ?? null;
  const isCurrency =
    (fieldUiSchema['ui:options'] as Record<string, unknown> | undefined)
      ?.isCurrency === true;

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <NumberField
          label={t('Min')}
          value={min}
          onChange={(value) =>
            onUpdateJsonSchema({ minimum: value ?? undefined })
          }
          className="flex-1"
        />
        <NumberField
          label={t('Max')}
          value={max}
          onChange={(value) =>
            onUpdateJsonSchema({ maximum: value ?? undefined })
          }
          className="flex-1"
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-neutral-charcoal">{t('Dollar amount?')}</span>
        <ToggleButton
          size="small"
          isSelected={isCurrency}
          onChange={(isSelected) =>
            onUpdateUiSchema({
              'ui:options': {
                ...(fieldUiSchema['ui:options'] as
                  | Record<string, unknown>
                  | undefined),
                isCurrency: isSelected,
              },
            })
          }
          aria-label={t('Dollar amount')}
        />
      </div>
    </div>
  );
}
