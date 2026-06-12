'use client';

import { useCollaborativeFragment } from '@/hooks/useCollaborativeFragment';
import { Select, SelectItem } from '@op/ui/Select';
import { useEffect, useRef, type Key } from 'react';

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
  /**
   * A value to auto-apply through this field's single writer (e.g. a
   * boundary-resolved council district). `undefined` means "no auto-resolution
   * settled yet — don't touch the selection"; `null` means "resolved to no
   * value". When the auto value changes, the previously auto-applied value is
   * swapped out; a value the user chose manually is otherwise preserved.
   *
   * Routing this through the field (rather than a second collaborative writer
   * on the same fragment) keeps a single writer per fragment — two writers race
   * under Yjs and duplicate the stored text.
   */
  autoValue?: string | null;
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
  autoValue,
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

  // Apply an externally-resolved value (e.g. a council district) through this
  // field's own writer, so the fragment has a single writer. Swaps out the
  // previously auto-applied value; leaves a manually chosen value otherwise.
  const appliedAutoRef = useRef<string | null>(null);
  useEffect(() => {
    if (autoValue === undefined) {
      return;
    }
    const previous = appliedAutoRef.current;
    if (autoValue === previous) {
      return;
    }

    let next: string | null;
    if (autoValue) {
      next = autoValue;
    } else {
      // Resolved to nothing: only clear the value we previously auto-applied.
      next = selectedValue === previous ? null : selectedValue;
    }

    appliedAutoRef.current = autoValue;
    if (next !== selectedValue) {
      setSelectedValue(next);
    }
  }, [autoValue, selectedValue]);

  if (options.length === 0) {
    return null;
  }

  const handleSelectionChange = (key: Key | null) => {
    if (key === null) {
      setSelectedValue(null);
      return;
    }
    const value = String(key);
    if (value === EMPTY_KEY) {
      setSelectedValue(null);
    } else {
      setSelectedValue(value);
    }
  };

  return (
    <Select
      variant="pill"
      size="medium"
      isRequired={required}
      placeholder={placeholder ?? t('Select option')}
      selectedKey={selectedValue}
      onSelectionChange={handleSelectionChange}
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
