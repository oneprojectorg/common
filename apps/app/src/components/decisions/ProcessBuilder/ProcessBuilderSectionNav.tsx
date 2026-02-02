'use client';

import { Key } from '@op/ui/RAC';
import { Tab, TabList, Tabs } from '@op/ui/Tabs';

import { useTranslations } from '@/lib/i18n';

import { type NavigationConfig } from './navigationConfig';
import { useProcessNavigation } from './useProcessNavigation';

export const ProcessBuilderSidebar = ({
  navigationConfig,
}: {
  navigationConfig?: NavigationConfig;
}) => {
  const t = useTranslations();
  const { visibleSections, currentSection, currentStep, setSection } =
    useProcessNavigation(navigationConfig);

  const handleSelectionChange = (key: Key) => {
    setSection(String(key));
  };

  // Don't render sidebar for single-section steps
  // These steps manage their own layout (e.g., template step with form builder)
  if (visibleSections.length <= 1) {
    return null;
  }

  return (
    <nav className="h-12 shrink-0 overflow-x-auto overflow-y-hidden p-0 py-4 md:sticky md:top-0 md:h-full md:w-64 md:overflow-x-hidden md:overflow-y-auto md:border-r md:p-8">
      <Tabs
        key={currentStep?.id}
        orientation="vertical"
        selectedKey={currentSection?.id}
        onSelectionChange={handleSelectionChange}
      >
        <TabList
          aria-label={t('Section navigation')}
          className="scrollbar-none flex w-full gap-4 border-none md:flex-col md:gap-1"
        >
          {visibleSections.map((section) => (
            <Tab
              key={section.id}
              id={section.id}
              variant="pill"
              className="selected:text-charcoal md:selected:bg-neutral-offWhite first:ml-4 last:mr-4 hover:bg-neutral-gray1 hover:text-charcoal focus-visible:outline-solid md:first:ml-0 md:last:mr-0"
            >
              {t(section.labelKey)}
            </Tab>
          ))}
        </TabList>
      </Tabs>
    </nav>
  );
};
