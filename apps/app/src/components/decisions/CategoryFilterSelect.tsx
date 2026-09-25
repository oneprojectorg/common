import { useTranslations } from '@/lib/i18n';

import { ResponsiveSelect } from './ResponsiveSelect';
import { ALL_CATEGORIES } from './proposalFilterQuery';

/**
 * Category filter dropdown shared by the proposals list and the review
 * screen, including the per-decision "districts" copy override.
 */
export const CategoryFilterSelect = ({
  decisionSlug,
  categories,
  selectedCategory,
  onSelectCategory,
  className,
}: {
  decisionSlug: string | undefined;
  categories: { id: string; name: string }[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  className?: string;
}) => {
  const t = useTranslations('decisions.proposals');

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
      className={className}
      aria-label={
        usesDistricts ? t('filterByDistrictLabel') : t('filterByCategoryLabel')
      }
      items={[
        {
          id: ALL_CATEGORIES,
          label: usesDistricts
            ? t('allDistrictsOption')
            : t('allCategoriesOption'),
        },
        ...categories.map((category) => ({
          id: category.id,
          label: category.name,
        })),
      ]}
    />
  );
};
