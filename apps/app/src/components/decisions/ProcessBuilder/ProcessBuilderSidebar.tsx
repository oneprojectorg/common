'use client';

import { Sidebar } from '@op/ui/Sidebar';
import { Tab, TabList, Tabs } from '@op/ui/Tabs';
import { Key } from 'react-aria-components';

import { useTranslations } from '@/lib/i18n';

import { useProcessBuilderContext } from './ProcessBuilderProvider';
import { useProcessNavigation } from './useProcessNavigation';

export const ProcessBuilderSidebar = () => {
  const t = useTranslations();
  const { navigationConfig } = useProcessBuilderContext();
  const { visibleSections, currentSection, currentStep, setSection } =
    useProcessNavigation(navigationConfig);

  console.log('[Sidebar] currentStep:', currentStep?.id, 'currentSection:', currentSection?.id, 'visibleSections:', visibleSections.length);

  const handleSelectionChange = (key: Key) => {
    setSection(String(key));
  };

  return (
    <Sidebar className="border-r p-8">
      {visibleSections.length > 0 && (
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
                // TODO: Figure out why focus styles aren't being picked up here
                className="hover:bg-neutral-gray1 hover:text-charcoal focus-visible:outline selected:bg-neutral-offWhite selected:text-neutral-gray4"
              >
                {t(section.labelKey)}
              </Tab>
            ))}
          </TabList>
        </Tabs>
      )}
    </Sidebar>
  );
};
