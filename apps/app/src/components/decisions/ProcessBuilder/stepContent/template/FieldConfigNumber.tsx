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
  field,
  onUpdateJsonSchema,
}: FieldConfigProps) {
  const t = useTranslations();

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <NumberField
          label={t('Min')}
          value={field.min ?? null}
          onChange={(value) =>
            onUpdateJsonSchema({ minimum: value ?? undefined })
          }
          className="flex-1"
        />
        <NumberField
          label={t('Max')}
          value={field.max ?? null}
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
          isSelected={field.isCurrency}
          onChange={(isSelected) =>
            onUpdateJsonSchema({
              'x-format': isSelected ? 'money' : 'number',
            })
          }
          aria-label={t('Dollar amount')}
        />
      </div>
    </div>
  );
}
