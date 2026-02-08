'use client';

import { useCollaborativeFragment } from '@/hooks/useCollaborativeFragment';
import { Select, SelectItem } from '@op/ui/Select';
import { useEffect, useRef } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useCollaborativeDoc } from './CollaborativeDocContext';

interface CategoryOption {
  id: string;
  name: string;
}

interface CollaborativeCategoryFieldProps {
  categories: CategoryOption[];
  initialValue?: string | null;
  onChange?: (category: string | null) => void;
}

/**
 * Collaborative category selector synced via Yjs XmlFragment.
 * When one user picks a category, all connected users see it update in real time.
 */
export function CollaborativeCategoryField({
  categories,
  initialValue = null,
  onChange,
}: CollaborativeCategoryFieldProps) {
  const t = useTranslations();
  const { ydoc } = useCollaborativeDoc();

  const [categoryText, setCategoryText] = useCollaborativeFragment(
    ydoc,
    'category',
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

  if (categories.length === 0) {
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
      placeholder={t('Select category')}
      selectedKey={selectedCategory}
      onSelectionChange={handleSelectionChange}
      selectValueClassName="text-primary-teal data-[placeholder]:text-primary-teal"
      className="w-auto max-w-36 overflow-hidden sm:max-w-96"
      popoverProps={{ className: 'sm:min-w-fit sm:max-w-2xl' }}
    >
      {categories.map((category) => (
        <SelectItem className="min-w-fit" key={category.id} id={category.name}>
          {category.name}
        </SelectItem>
      ))}
    </Select>
  );
}
