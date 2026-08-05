'use client';

import type { XFormatPropertySchema } from '@op/common/client';
import { parseSchemaOptions } from '@op/common/client';
import { Select, SelectItem } from '@op/ui/Select';
import type { Key } from 'react';

import { useTranslations } from '@/lib/i18n';

/**
 * Shared select control for a scored or single-select rubric criterion.
 * Used by the live review form and, uncontrolled, by the builder preview —
 * keeping both in lockstep so the preview never drifts from what reviewers
 * actually see.
 */
export function RubricCriterionSelect({
  schema,
  kind,
  selectedKey,
  onSelectionChange,
  variant,
  size,
  className = 'w-full',
  selectValueClassName,
  placeholder,
}: {
  schema: XFormatPropertySchema;
  kind: 'scored' | 'single_select';
  selectedKey?: string | null;
  onSelectionChange?: (key: Key | null) => void;
  variant?: 'default' | 'pill';
  size?: 'small' | 'medium';
  className?: string;
  selectValueClassName?: string;
  placeholder?: string;
}) {
  const t = useTranslations();

  const options =
    kind === 'scored'
      ? [...parseSchemaOptions(schema)].sort(
          (a, b) => Number(b.value) - Number(a.value),
        )
      : parseSchemaOptions(schema);

  return (
    <Select
      aria-label={schema.title}
      placeholder={placeholder ?? t('Select an option')}
      selectedKey={selectedKey}
      onSelectionChange={onSelectionChange}
      isDisabled={options.length === 0}
      variant={variant}
      size={size}
      selectValueClassName={selectValueClassName}
      className={className}
    >
      {options.map((option) => {
        if (kind === 'scored') {
          const triggerLabel = option.title
            ? `${option.value} - ${option.title}`
            : String(option.value);

          return (
            <SelectItem
              key={String(option.value)}
              id={String(option.value)}
              textValue={triggerLabel}
            >
              {option.title ? (
                <div className="flex flex-col">
                  <span>{option.value}</span>
                  <span className="text-sm text-neutral-gray4">
                    {option.title}
                  </span>
                </div>
              ) : (
                String(option.value)
              )}
            </SelectItem>
          );
        }

        const label = option.title || String(option.value);

        return (
          <SelectItem
            key={String(option.value)}
            id={String(option.value)}
            textValue={label}
          >
            {option.description ? (
              <div className="flex flex-col">
                <span>{label}</span>
                <span className="text-sm text-neutral-gray4">
                  {option.description}
                </span>
              </div>
            ) : (
              label
            )}
          </SelectItem>
        );
      })}
    </Select>
  );
}
