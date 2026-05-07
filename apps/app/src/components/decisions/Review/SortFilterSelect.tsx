'use client';

import { parseAsStringLiteral, useQueryState } from 'nuqs';

import { useTranslations } from '@/lib/i18n';

import { ResponsiveSelect } from '../ResponsiveSelect';

const SORT_DIRS = ['asc', 'desc'] as const;

export function useSortDir() {
  return useQueryState(
    'sort',
    parseAsStringLiteral(SORT_DIRS).withDefault('desc'),
  );
}

export function SortFilterSelect() {
  const t = useTranslations();
  const [dir, setDir] = useSortDir();

  return (
    <ResponsiveSelect
      selectedKey={dir === 'asc' ? 'oldest' : 'newest'}
      onSelectionChange={(key) => setDir(key === 'oldest' ? 'asc' : 'desc')}
      aria-label={t('Sort order')}
      items={[
        { id: 'newest', label: t('Newest First') },
        { id: 'oldest', label: t('Oldest First') },
      ]}
    />
  );
}
