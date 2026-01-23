'use client';

import { Key } from '@op/ui/RAC';
import { Sidebar } from '@op/ui/Sidebar';
import { Tab, TabList, Tabs } from '@op/ui/Tabs';

import { useTranslations } from '@/lib/i18n';

import { useProcessBuilderContext } from './ProcessBuilderProvider';
import { useProcessNavigation } from './useProcessNavigation';

export const ProcessBuilderSidebar = () => {
  const t = useTranslations();
  const { navigationConfig } = useProcessBuilderContext();
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
    <Sidebar className="border-r p-8">
      <Tabs
        key={currentStep?.id}
        orientation="vertical"
        selectedKey={currentSection?.id}
        onSelectionChange={handleSelectionChange}
      >
        <TabList
          aria-label={t('Section navigation')}
          className="flex w-full flex-col gap-1 border-none"
        >
          {visibleSections.map((section) => (
            <Tab
              key={section.id}
              id={section.id}
              variant="pill"
              className="hover:bg-neutral-gray1 hover:text-charcoal focus-visible:outline-solid selected:bg-neutral-offWhite selected:text-neutral-gray4"
            >
              {t(section.labelKey)}
            </Tab>
          ))}
        </TabList>
      </Tabs>
    </Sidebar>
  );
};
