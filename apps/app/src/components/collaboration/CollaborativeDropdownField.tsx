'use client';

import { useCollaborativeFragment } from '@/hooks/useCollaborativeFragment';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { useEffect, useMemo, useRef } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useCollaborativeDoc } from './CollaborativeDocContext';

const EMPTY_KEY = '__none__';

interface CollaborativeDropdownFieldProps {
  options: Array<{ value: string; label: string }>;
  initialValue?: string | null;
  onChange?: (value: string | null) => void;
  /** Yjs fragment name used to sync this field. Must be unique per dropdown instance. */
  fragmentName: string;
  /** Placeholder text shown when no value is selected. */
  placeholder?: string;
  /** When true, prepends a "None" option that clears the selection back to null. */
  allowEmpty?: boolean;
  /** When true, sets `aria-required` on the select for assistive tech. */
  required?: boolean;
}

/**
 * Collaborative dropdown selector synced via Yjs XmlFragment.
 * When one user picks a value, all connected users see it update in real time.
 */
export function CollaborativeDropdownField({
  options,
  initialValue = null,
  onChange,
  fragmentName,
  placeholder,
  allowEmpty = false,
  required = false,
}: CollaborativeDropdownFieldProps) {
  const t = useTranslations();
  const { ydoc } = useCollaborativeDoc();

  const [syncedText, setSyncedText] = useCollaborativeFragment(
    ydoc,
    fragmentName,
    initialValue ?? '',
  );
  const selectedValue = syncedText || null;
  const setSelectedValue = (value: string | null) => setSyncedText(value ?? '');

  const onChangeRef = useRef(onChange);
  const lastEmittedValueRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (lastEmittedValueRef.current === selectedValue) {
      return;
    }

    lastEmittedValueRef.current = selectedValue;
    onChangeRef.current?.(selectedValue);
  }, [selectedValue]);

  // Value→label map so base-ui's SelectValue renders the label, not the raw id.
  const itemLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    if (allowEmpty) {
      labels[EMPTY_KEY] = t('None');
    }
    for (const option of options) {
      labels[option.value] = option.label;
    }
    return labels;
  }, [options, allowEmpty, t]);

  if (options.length === 0) {
    return null;
  }

  const resolvedPlaceholder = placeholder ?? t('Select option');

  const handleValueChange = (value: string | null) => {
    if (value === null || value === EMPTY_KEY) {
      setSelectedValue(null);
      return;
    }
    setSelectedValue(value);
  };

  return (
    <Select
      items={itemLabels}
      value={selectedValue}
      onValueChange={handleValueChange}
      required={required}
    >
      <SelectTrigger
        aria-label={resolvedPlaceholder}
        aria-required={required || undefined}
        // Keeps the @op/ui "pill" look: tinted fill, teal label, no border.
        className="w-fit max-w-full border-0 bg-accent text-primary shadow-none data-placeholder:text-primary"
      >
        <SelectValue placeholder={resolvedPlaceholder} />
      </SelectTrigger>
      <SelectContent className="sm:max-w-2xl sm:min-w-fit">
        {allowEmpty && <SelectItem value={EMPTY_KEY}>{t('None')}</SelectItem>}
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
