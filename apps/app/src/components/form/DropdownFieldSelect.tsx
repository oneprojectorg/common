'use client';

import { Select, SelectItem } from '@op/ui/Select';
import type { Key } from 'react';

import { useTranslations } from '@/lib/i18n';

const EMPTY_KEY = '__none__';

export interface DropdownFieldSelectProps {
  options: Array<{ value: string; label: string }>;
  /** Omit for an uncontrolled select (e.g. a builder preview). */
  selectedKey?: string | null;
  /** Receives `null` for both the "None" item and RAC's own clear action. */
  onSelectionChange?: (value: string | null) => void;
  placeholder?: string;
  /** When true, prepends a "None" option that clears the selection back to null. */
  allowEmpty?: boolean;
  /** When true, sets `aria-required` on the select for assistive tech. */
  required?: boolean;
}

/**
 * Presentational pill select for a single dropdown value. Shared by the
 * collaborative proposal editor and the template builder preview so both
 * stay visually and behaviorally in sync.
 */
export function DropdownFieldSelect({
  options,
  selectedKey,
  onSelectionChange,
  placeholder,
  allowEmpty = false,
  required = false,
}: DropdownFieldSelectProps) {
  const t = useTranslations();

  if (options.length === 0) {
    return null;
  }

  const handleSelectionChange = (key: Key | null) => {
    if (key === null) {
      onSelectionChange?.(null);
      return;
    }
    const value = String(key);
    onSelectionChange?.(value === EMPTY_KEY ? null : value);
  };

  return (
    <Select
      variant="pill"
      size="medium"
      isRequired={required}
      placeholder={placeholder ?? t('Select option')}
      selectedKey={selectedKey}
      onSelectionChange={onSelectionChange && handleSelectionChange}
      selectValueClassName="text-primary-teal data-[placeholder]:text-primary-teal"
      className="w-fit max-w-full"
      popoverProps={{ className: 'sm:min-w-fit sm:max-w-2xl' }}
    >
      {allowEmpty && (
        <SelectItem className="min-w-fit" key={EMPTY_KEY} id={EMPTY_KEY}>
          {t('None')}
        </SelectItem>
      )}
      {options.map((opt) => (
        <SelectItem className="min-w-fit" key={opt.value} id={opt.value}>
          {opt.label}
        </SelectItem>
      ))}
    </Select>
  );
}
