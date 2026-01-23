'use client';

import { Button } from '@op/ui/Button';
import { Tab, TabList, Tabs } from '@op/ui/Tabs';
import { Key } from 'react-aria-components';
import { LuChevronRight, LuCircleAlert, LuHouse, LuPlus } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { UserAvatarMenu } from '@/components/SiteHeader';

import { useProcessBuilderContext } from './ProcessBuilderProvider';
import { useProcessNavigation } from './useProcessNavigation';

export const ProcessBuilderHeader = ({
  processName,
}: {
  processName?: string;
}) => {
  const t = useTranslations();
  const { navigationConfig } = useProcessBuilderContext();
  const { visibleSteps, currentStep, setStep } =
    useProcessNavigation(navigationConfig);

  const handleSelectionChange = (key: Key) => {
    setStep(String(key));
  };

  return (
    <header className="relative flex h-14 w-dvw items-center justify-between border-b">
      <div className="relative z-10 flex items-center gap-2 pl-4 md:pl-8">
        <Link href="/" className="flex items-center gap-2 text-primary">
          <LuHouse className="size-4" />
          {t('Home')}
        </Link>
        <LuChevronRight className="size-4" />
        <span>{processName || t('New process')}</span>
      </div>
      <nav className="absolute z-0 hidden h-full w-full justify-center md:flex">
        {visibleSteps.length > 0 && (
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
        )}
      </nav>
      <div className="relative z-10 flex gap-4 pr-4 md:pr-8">
        {visibleSteps.length > 0 && (
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
    </header>
  );
};
