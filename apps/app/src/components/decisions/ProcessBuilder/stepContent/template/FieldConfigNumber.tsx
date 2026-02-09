'use client';

import { NumberField } from '@op/ui/NumberField';
import { ToggleButton } from '@op/ui/ToggleButton';

import { useTranslations } from '@/lib/i18n';

import type { FieldConfigProps } from './fieldRegistry';

/**
 * Field config component for number fields.
 * Allows setting min/max constraints and currency mode.
 */
export function FieldConfigNumber({ field, onUpdate }: FieldConfigProps) {
  const t = useTranslations();

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <NumberField
          label={t('Min')}
          value={field.min ?? null}
          onChange={(value) => onUpdate({ min: value ?? undefined })}
          className="flex-1"
        />
        <NumberField
          label={t('Max')}
          value={field.max ?? null}
          onChange={(value) => onUpdate({ max: value ?? undefined })}
          className="flex-1"
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-neutral-charcoal">{t('Dollar amount?')}</span>
        <ToggleButton
          size="small"
          isSelected={field.isCurrency ?? false}
          onChange={(isSelected) => onUpdate({ isCurrency: isSelected })}
          aria-label={t('Dollar amount')}
        />
      </div>
    </div>
  );
}
