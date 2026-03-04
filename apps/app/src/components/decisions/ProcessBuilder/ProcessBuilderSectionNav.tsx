'use client';

import { useTranslations } from '@/lib/i18n';

import { useNavigationConfig } from './useNavigationConfig';
import { useProcessNavigation } from './useProcessNavigation';

export const ProcessBuilderSidebar = ({
  instanceId,
}: {
  instanceId: string;
}) => {
  const t = useTranslations();
  const navigationConfig = useNavigationConfig(instanceId);
  const { visibleSections, currentSection, setSection } =
    useProcessNavigation(navigationConfig);

  return (
    <nav
      aria-label={t('Section navigation')}
      className="hidden shrink-0 md:sticky md:top-0 md:flex md:h-full md:w-60 md:flex-col md:overflow-y-auto md:border-r md:p-4"
    >
      <ul className="flex flex-col gap-1">
        {visibleSections.map((section) => {
          const isActive = currentSection?.id === section.id;
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => setSection(section.id)}
                className={`w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  isActive
                    ? 'bg-primary-tealWhite text-primary font-medium'
                    : 'text-charcoal hover:bg-neutral-gray1'
                }`}
              >
                {t(section.labelKey)}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
