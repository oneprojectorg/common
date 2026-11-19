import { Skeleton } from '@op/sense/Skeleton';

import { useTranslations } from '@/lib/i18n';

import { ResponsiveSelect } from './ResponsiveSelect';
import { usesDistrictCategoryTerm } from './categoryTerm';
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

  const usesDistricts = usesDistrictCategoryTerm(decisionSlug);

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

// ResponsiveSelect caps its phone trigger at 12rem.
export function CategoryFilterSkeleton() {
  return <Skeleton aria-hidden className="h-11 w-full max-w-48 sm:w-48" />;
}
