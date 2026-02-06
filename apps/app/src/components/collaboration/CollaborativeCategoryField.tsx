'use client';

import { useCollaborativeField } from '@/hooks/useCollaborativeField';
import { Select, SelectItem } from '@op/ui/Select';

import { useTranslations } from '@/lib/i18n';

import { useCollaborativeDoc } from './CollaborativeDocContext';

interface CategoryOption {
  id: string;
  name: string;
}

interface CollaborativeCategoryFieldProps {
  /** Available categories to choose from */
  categories: CategoryOption[];
  /** Initial value from the database (used before Yjs syncs) */
  initialValue?: string | null;
  /** Called when the value changes — use for DB persistence */
  onChange?: (category: string | null) => void;
  className?: string;
}

/**
 * Collaborative category selector synced via Yjs Y.Map.
 * When one user picks a category, all connected users see it update in real time.
 */
export function CollaborativeCategoryField({
  categories,
  initialValue = null,
  onChange,
  className,
}: CollaborativeCategoryFieldProps) {
  const t = useTranslations();
  const { ydoc } = useCollaborativeDoc();

  const [selectedCategory, setSelectedCategory] = useCollaborativeField<
    string | null
  >(ydoc, 'category', initialValue);

  if (categories.length === 0) {
    return null;
  }

  const handleSelectionChange = (key: string | number) => {
    const value = String(key);
    setSelectedCategory(value);
    onChange?.(value);
  };

  return (
    <Select
      variant="pill"
      size="medium"
      placeholder={t('Select category')}
      selectedKey={selectedCategory}
      onSelectionChange={handleSelectionChange}
      className={className ?? 'w-auto max-w-36 overflow-hidden sm:max-w-96'}
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
