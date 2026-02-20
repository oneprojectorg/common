'use client';

import { useCollaborativeFragment } from '@/hooks/useCollaborativeFragment';
import { Select, SelectItem } from '@op/ui/Select';
import { useEffect, useRef } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useCollaborativeDoc } from './CollaborativeDocContext';

interface CollaborativeCategoryFieldProps {
  options: Array<{ value: string; label: string }>;
  initialValue?: string | null;
  onChange?: (category: string | null) => void;
  /** Yjs fragment name used to sync this field. Defaults to `'category'`. */
  fragmentName?: string;
  /** Placeholder text shown when no value is selected. Defaults to `'Select category'`. */
  placeholder?: string;
}

/**
 * Collaborative category/dropdown selector synced via Yjs XmlFragment.
 * When one user picks a value, all connected users see it update in real time.
 *
 * Each instance **must** use a unique `fragmentName` to avoid clobbering
 * other dropdown fields in the same collaborative document.
 */
export function CollaborativeCategoryField({
  options,
  initialValue = null,
  onChange,
  fragmentName = 'category',
  placeholder,
}: CollaborativeCategoryFieldProps) {
  const t = useTranslations();
  const { ydoc } = useCollaborativeDoc();

  const [categoryText, setCategoryText] = useCollaborativeFragment(
    ydoc,
    fragmentName,
    initialValue ?? '',
  );
  const selectedCategory = categoryText || null;
  const setSelectedCategory = (value: string | null) =>
    setCategoryText(value ?? '');

  const onChangeRef = useRef(onChange);
  const lastEmittedValueRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (lastEmittedValueRef.current === selectedCategory) {
      return;
    }

    lastEmittedValueRef.current = selectedCategory;
    onChangeRef.current?.(selectedCategory);
  }, [selectedCategory]);

  if (options.length === 0) {
    return null;
  }

  const handleSelectionChange = (key: string | number) => {
    const value = String(key);
    setSelectedCategory(value);
  };

  return (
    <Select
      variant="pill"
      size="medium"
      placeholder={placeholder ?? t('Select option')}
      selectedKey={selectedCategory}
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
