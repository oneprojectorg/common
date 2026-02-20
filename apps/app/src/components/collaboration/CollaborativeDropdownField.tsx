'use client';

import { useCollaborativeFragment } from '@/hooks/useCollaborativeFragment';
import { Select, SelectItem } from '@op/ui/Select';
import { useEffect, useRef } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useCollaborativeDoc } from './CollaborativeDocContext';

interface CollaborativeDropdownFieldProps {
  options: Array<{ value: string; label: string }>;
  initialValue?: string | null;
  onChange?: (value: string | null) => void;
  /** Yjs fragment name used to sync this field. Must be unique per dropdown instance. */
  fragmentName: string;
  /** Placeholder text shown when no value is selected. */
  placeholder?: string;
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
    setSelectedValue(value);
  };

  return (
    <Select
      variant="pill"
      size="medium"
      placeholder={placeholder ?? t('Select option')}
      selectedKey={selectedValue}
      onSelectionChange={handleSelectionChange}
      selectValueClassName="text-primary-teal data-[placeholder]:text-primary-teal"
      className="w-auto max-w-36 overflow-hidden sm:max-w-96"
      popoverProps={{ className: 'sm:min-w-fit sm:max-w-2xl' }}
    >
      {options.map((opt) => (
        <SelectItem className="min-w-fit" key={opt.value} id={opt.value}>
          {opt.label}
        </SelectItem>
      ))}
    </Select>
  );
}
