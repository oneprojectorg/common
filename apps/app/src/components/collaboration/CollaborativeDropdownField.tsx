'use client';

import { useCollaborativeFragment } from '@/hooks/useCollaborativeFragment';
import { useEffect, useRef } from 'react';

import { DropdownFieldSelect } from '@/components/form/DropdownFieldSelect';

import { useCollaborativeDoc } from './CollaborativeDocContext';

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

  return (
    <DropdownFieldSelect
      options={options}
      selectedKey={selectedValue}
      onSelectionChange={setSelectedValue}
      placeholder={placeholder}
      allowEmpty={allowEmpty}
      required={required}
    />
  );
}
