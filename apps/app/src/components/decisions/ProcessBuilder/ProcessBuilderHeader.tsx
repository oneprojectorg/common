'use client';

import { Button } from '@op/ui/Button';
import { Key } from '@op/ui/RAC';
import { Sidebar, SidebarTrigger } from '@op/ui/Sidebar';
import { Tab, TabList, Tabs } from '@op/ui/Tabs';
import { LuChevronRight, LuCircleAlert, LuHouse, LuPlus } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { UserAvatarMenu } from '@/components/SiteHeader';

import { type NavigationConfig } from './navigationConfig';
import { useProcessNavigation } from './useProcessNavigation';

export const ProcessBuilderHeader = ({
  processName,
  navigationConfig,
}: {
  processName?: string;
  navigationConfig?: NavigationConfig;
}) => {
  const t = useTranslations();
  const { visibleSteps, currentStep, setStep } =
    useProcessNavigation(navigationConfig);

  const handleSelectionChange = (key: Key) => {
    setStep(String(key));
  };

  const hasSteps = visibleSteps.length > 0;

  return (
    <header className="relative sticky top-0 z-20 flex h-14 w-dvw shrink-0 items-center justify-between border-b bg-white">
      <div className="relative z-10 flex items-center gap-2 pl-4 md:pl-8">
        {hasSteps ? (
          <SidebarTrigger />
        ) : (
          <>
            <Link href="/" className="flex items-center gap-2 text-primary">
              <LuHouse className="size-4" />
              {t('Home')}
            </Link>
            <LuChevronRight className="size-4" />
          </>
        )}
        <span>{processName || t('New process')}</span>
      </div>
      {hasSteps && (
        <nav className="absolute z-0 hidden h-full w-full justify-center md:flex">
          <Tabs
            selectedKey={currentStep?.id}
            onSelectionChange={handleSelectionChange}
            className="h-full"
          >
            <TabList
              aria-label={t('Process steps')}
              className="h-full border-none"
            >
              {visibleSteps.map((step) => (
                <Tab key={step.id} id={step.id} className="h-full">
                  {t(step.labelKey)}
                </Tab>
              ))}
            </TabList>
          </Tabs>
        </nav>
      )}
      <div className="relative z-10 flex gap-4 pr-4 md:pr-8">
        {hasSteps && (
          <div className="flex gap-2">
            <Button
              className="flex aspect-square h-8 gap-2 rounded-sm md:aspect-auto"
              color="warn"
            >
              <LuCircleAlert className="size-4 shrink-0" />
              <span className="hidden md:block">
                {t(
                  '{stepCount, plural, =1 {1 step} other {# steps}} remaining',
                  {
                    stepCount: 3,
                  },
                )}
              </span>
            </Button>
            <Button className="h-8 rounded-sm">
              <LuPlus className="size-4" />
              {t('Launch')}
              <span className="hidden md:inline"> {t('Process')}</span>
            </Button>
          </div>
        )}
        <UserAvatarMenu className="hidden md:block" />
      </div>
      {hasSteps && (
        <Sidebar className="z-30">
          <nav className="flex flex-col gap-2 px-4 py-2">
            <Link href="/" className="flex h-8 items-center gap-2 px-4">
              <LuHouse className="size-4" />
              {t('Home')}
            </Link>
            <hr />

            <Tabs
              selectedKey={currentStep?.id}
              onSelectionChange={handleSelectionChange}
              className="h-full"
            >
              <TabList
                aria-label={t('Process steps')}
                className="w-full flex-col gap-1 border-none"
              >
                {visibleSteps.map((step) => (
                  <Tab
                    key={step.id}
                    id={step.id}
                    variant="pill"
                    className="h-8 bg-transparent selected:bg-neutral-offWhite"
                  >
                    {t(step.labelKey)}
                  </Tab>
                ))}
              </TabList>
            </Tabs>
          </nav>
        </Sidebar>
      )}
    </header>
  );
};
