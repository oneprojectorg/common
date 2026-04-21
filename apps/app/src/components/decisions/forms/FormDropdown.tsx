'use client';

import { Select, SelectItem } from '@op/ui/Select';
import type { Key } from 'react';

import { useTranslations } from '@/lib/i18n';

export interface FormDropdownOption {
  value: string | number;
  label: string;
  description?: string;
}

interface FormDropdownProps {
  ariaLabel?: string;
  placeholder?: string;
  selectedKey: string | null;
  onSelectionChange: (key: Key | null) => void;
  options: FormDropdownOption[];
  className?: string;
}

/**
 * Generic dropdown for decision forms.
 *
 * Renders each option's `label`; when an option is selected and has a
 * `description`, it surfaces as helper text under the field. Callers shape
 * their schema options into `FormDropdownOption` however their domain
 * requires (e.g. rubric scoring prefixes the numeric value onto the label).
 */
export function FormDropdown({
  ariaLabel,
  placeholder,
  selectedKey,
  onSelectionChange,
  options,
  className,
}: FormDropdownProps) {
  const t = useTranslations();
  const selected = options.find(
    (option) => String(option.value) === selectedKey,
  );

  return (
    <Select
      aria-label={ariaLabel}
      placeholder={placeholder ?? t('Select an option')}
      selectedKey={selectedKey}
      onSelectionChange={onSelectionChange}
      description={selected?.description}
      className={className ?? 'w-full'}
    >
      {options.map((option) => (
        <SelectItem key={String(option.value)} id={String(option.value)}>
          {option.label}
        </SelectItem>
      ))}
    </Select>
  );
}
