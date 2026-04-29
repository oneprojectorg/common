'use client';

import { useCollaborativeFragment } from '@/hooks/useCollaborativeFragment';
import { Select, SelectItem } from '@op/ui/Select';
import { useEffect, useRef } from 'react';

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

  if (options.length === 0) {
    return null;
  }

  const handleSelectionChange = (key: string | number) => {
    const value = String(key);
    if (value === EMPTY_KEY) {
      setSelectedValue(null);
    } else {
      setSelectedValue(value);
    }
  };

  return (
    <Select
      placeholder={placeholder ?? t('Select option')}
      selectedKey={selectedValue}
      onSelectionChange={handleSelectionChange}
      className="w-auto max-w-36 overflow-hidden sm:max-w-96"
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
