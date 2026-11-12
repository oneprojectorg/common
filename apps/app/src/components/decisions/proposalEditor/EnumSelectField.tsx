'use client';

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@op/sense/Field';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

/** Enum dropdown. `items` lets base-ui's `Select.Value` show a translated label. */
export function EnumSelectField({
  fieldId,
  label,
  description,
  error,
  isRequired,
  options,
  value,
  onChange,
}: {
  fieldId: string;
  label: ReactNode;
  description?: ReactNode;
  error?: string;
  isRequired: boolean;
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (value: unknown) => void;
}) {
  const t = useTranslations();

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={fieldId}>
        {label}
        {isRequired ? <RequiredAsterisk /> : null}
      </FieldLabel>
      <Select
        items={options}
        value={value}
        onValueChange={(next) =>
          onChange(next == null ? undefined : String(next))
        }
        required={isRequired}
      >
        <SelectTrigger
          id={fieldId}
          className="w-full"
          aria-invalid={Boolean(error)}
        >
          {/* The trigger clamps, so `<bdi>` alone would clip the wrong end. */}
          <SelectValue
            dir="auto"
            className="ltr:text-left rtl:text-right"
            placeholder={t('decisions.proposals.selectOptionPlaceholder')}
          />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <bdi>{option.label}</bdi>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {error ? <FieldError>{error}</FieldError> : null}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  );
}
