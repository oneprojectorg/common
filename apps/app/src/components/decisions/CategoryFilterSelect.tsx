import { useTranslations } from '@/lib/i18n';

import { FilterBarSelect } from './FilterBar';
import { usesDistrictCategoryTerm } from './categoryTerm';
import { ALL_CATEGORIES } from './proposalFilterQuery';

/**
 * Category filter dropdown shared by the decision lists, including the
 * per-decision "districts" copy override.
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

  const usesDistricts = usesDistrictCategoryTerm(decisionSlug);

  return (
    <FilterBarSelect
      value={selectedCategory}
      onChange={onSelectCategory}
      className={className}
      label={
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
