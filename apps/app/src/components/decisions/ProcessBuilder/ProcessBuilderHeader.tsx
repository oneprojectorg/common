'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { trpc } from '@op/api/client';
import { Key } from '@op/ui/RAC';
import {
  Sidebar,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@op/ui/Sidebar';
import { Tab, TabList, Tabs } from '@op/ui/Tabs';
import { LuChevronRight, LuHouse } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { UserAvatarMenu } from '@/components/SiteHeader';

import { useProcessBuilderStore } from './stores/useProcessBuilderStore';
import { useNavigationConfig } from './useNavigationConfig';
import { useProcessNavigation } from './useProcessNavigation';

export const ProcessBuilderHeader = ({
  instanceId,
  slug,
}: {
  instanceId?: string;
  slug?: string;
}) => {
  if (!instanceId) {
    return <CreateModeHeader />;
  }

  return (
    <SidebarProvider>
      <ProcessBuilderHeaderContent instanceId={instanceId} slug={slug} />
      <MobileSidebar instanceId={instanceId} />
    </SidebarProvider>
  );
};

const CreateModeHeader = () => {
  const t = useTranslations();

  return (
    <header className="relative sticky top-0 z-20 flex h-14 w-dvw shrink-0 items-center justify-between border-b bg-white">
      <div className="flex items-center gap-2 pl-4 md:pl-8">
        <Link
          href="/"
          className="hidden items-center gap-2 text-primary md:flex"
        >
          <LuHouse className="size-4" />
          {t('Home')}
        </Link>
        <LuChevronRight className="hidden size-4 md:block" />
        <span>{t('New process')}</span>
      </div>
      <div className="pr-4 md:pr-8">
        <UserAvatarMenu className="hidden md:block" />
      </div>
    </header>
  );
};

const ProcessBuilderHeaderContent = ({
  slug,
}: {
  instanceId: string;
  slug?: string;
}) => {
  const t = useTranslations();

  const { data: decisionProfile } = trpc.decision.getDecisionBySlug.useQuery(
    { slug: slug! },
    { enabled: !!slug },
  );

  const decisionProfileId = decisionProfile?.id;

  const storeData = useProcessBuilderStore((s) =>
    decisionProfileId ? s.instances[decisionProfileId] : undefined,
  );
  const displayName =
    storeData?.name || decisionProfile?.name || t('New process');

  return (
    <header className="relative sticky top-0 z-20 flex h-14 w-dvw shrink-0 items-center justify-between border-b bg-white">
      <div className="flex items-center gap-2 pl-4 md:pl-8">
        <SidebarTrigger className="size-4 sm:hidden" />
        <Link
          href="/"
          className="hidden items-center gap-2 text-primary sm:flex"
        >
          <LuHouse className="size-4" />
          {t('Home')}
        </Link>
        <LuChevronRight className="hidden size-4 sm:block" />
        <span className="truncate">{displayName}</span>
      </div>
      <div className="pr-4 md:pr-8">
        <UserAvatarMenu className="hidden sm:block" />
      </div>
    </header>
  );
};

const MobileSidebar = ({ instanceId }: { instanceId: string }) => {
  const t = useTranslations();
  const rubricBuilderEnabled = useFeatureFlag('rubric_builder');
  const navigationConfig = useNavigationConfig(instanceId);
  const { visibleSteps, currentStep, setStep } =
    useProcessNavigation(navigationConfig);
  const hasSteps = visibleSteps.length > 0;
  const { setOpen } = useSidebar();

  const handleSelectionChange = (key: Key) => {
    setStep(String(key));
    setOpen(false);
  };

  if (!hasSteps) {
    return null;
  }
  return (
    <Sidebar mobileOnly>
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
            className="w-full"
            orientation="vertical"
          >
            {visibleSteps.map((step) => (
              <Tab
                key={step.id}
                id={step.id}
                variant="pill"
                className="flex h-8 items-center gap-2 bg-transparent selected:bg-neutral-offWhite"
              >
                {t(step.labelKey)}
                {step.id === 'rubric' && !rubricBuilderEnabled && (
                  <ComingSoonIndicator />
                )}
              </Tab>
            ))}
          </TabList>
        </Tabs>
      </nav>
    </Sidebar>
  );
};

const ComingSoonIndicator = () => {
  const t = useTranslations();
  return (
    <span className="rounded-full bg-neutral-gray1 px-2 py-0.5 text-sm text-neutral-gray4">
      {t('Coming soon')}
    </span>
  );
};
