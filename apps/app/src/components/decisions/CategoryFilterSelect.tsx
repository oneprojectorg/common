import { useTranslations } from '@/lib/i18n';

import { TranslatedText } from '../TranslatedText';
import { ResponsiveSelect } from './ResponsiveSelect';

export const ALL_CATEGORIES = 'all-categories';

/**
 * Category filter dropdown shared by the proposals list and the review
 * screen, including the per-decision "districts" copy override.
 */
export const CategoryFilterSelect = ({
  decisionSlug,
  categories,
  selectedCategory,
  onSelectCategory,
}: {
  decisionSlug: string | undefined;
  categories: { id: string; name: string }[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}) => {
  const t = useTranslations();

  // TODO: This is a hardcoded, per-decision copy override — the Columbus
  // decision refers to its categories as "districts", matched here on its
  // decision slug. Replace this with a proper configurable terminology/labeling
  // mechanism (e.g. per-process category term settings) instead of matching on
  // a hardcoded slug so we don't accrue more of these.
  const usesDistricts = decisionSlug === 'columbus';

  return (
    <ResponsiveSelect
      selectedKey={selectedCategory}
      onSelectionChange={onSelectCategory}
      aria-label={
        usesDistricts
          ? t('Filter proposals by district')
          : t('Filter proposals by category')
      }
      items={[
        {
          id: ALL_CATEGORIES,
          label: usesDistricts ? (
            <TranslatedText text="All districts" />
          ) : (
            <TranslatedText text="All categories" />
          ),
          textValue: usesDistricts ? t('All districts') : t('All categories'),
        },
        ...categories.map((category) => ({
          id: category.id,
          label: category.name,
        })),
      ]}
    />
  );
};
