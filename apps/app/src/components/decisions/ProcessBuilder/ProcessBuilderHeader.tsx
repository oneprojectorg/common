'use client';

import { trpc } from '@op/api/client';
import { ProcessStatus } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { DialogTrigger } from '@op/ui/Dialog';
import { Popover } from '@op/ui/Popover';
import { Key } from '@op/ui/RAC';
import {
  Sidebar,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@op/ui/Sidebar';
import { Tab, TabList, Tabs } from '@op/ui/Tabs';
import { toast } from '@op/ui/Toast';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LuCheck,
  LuChevronRight,
  LuCircle,
  LuCircleAlert,
  LuHouse,
  LuPlus,
  LuSave,
} from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { UserAvatarMenu } from '@/components/SiteHeader';

import { LaunchProcessModal } from './LaunchProcessModal';
import { useProcessBuilderStore } from './stores/useProcessBuilderStore';
import { useNavigationConfig } from './useNavigationConfig';
import { useProcessNavigation } from './useProcessNavigation';
import type { ValidationSummary } from './validation/processBuilderValidation';
import { useProcessBuilderValidation } from './validation/useProcessBuilderValidation';

export const ProcessBuilderHeader = ({
  processName,
  instanceId,
  slug,
}: {
  processName?: string;
  instanceId?: string;
  slug?: string;
}) => {
  if (!instanceId) {
    return <CreateModeHeader />;
  }

  return (
    <SidebarProvider>
      <ProcessBuilderHeaderContent
        processName={processName}
        instanceId={instanceId}
        slug={slug}
      />

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
  processName,
  instanceId,
  slug,
}: {
  processName?: string;
  instanceId: string;
  slug?: string;
}) => {
  const t = useTranslations();
  const router = useRouter();
  const navigationConfig = useNavigationConfig(instanceId);
  const { visibleSteps, currentStep, setStep } =
    useProcessNavigation(navigationConfig);
  const hasSteps = visibleSteps.length > 0;

  const { data: instance } = trpc.decision.getInstance.useQuery(
    { instanceId: instanceId! },
    { enabled: !!instanceId },
  );

  const instanceStatus = instance?.status as ProcessStatus | undefined;
  const decisionProfileId = instance?.profileId ?? undefined;
  const validation = useProcessBuilderValidation(decisionProfileId);

  const storeData = useProcessBuilderStore((s) =>
    decisionProfileId ? s.instances[decisionProfileId] : undefined,
  );
  const displayName = storeData?.name || processName || t('New process');

  const { setOpen } = useSidebar();
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);

  const isDraft = instanceStatus === ProcessStatus.DRAFT;
  const isTerminalStatus =
    instanceStatus === ProcessStatus.COMPLETED ||
    instanceStatus === ProcessStatus.CANCELLED;

  const utils = trpc.useUtils();

  // Save mutation for non-draft states
  const updateInstance = trpc.decision.updateDecisionInstance.useMutation({
    onSuccess: () => {
      toast.success({ message: t('Changes saved successfully') });
      if (slug) {
        router.push(`/decisions/${slug}`);
      }
    },
    onError: (error) => {
      toast.error({
        message: t('Failed to save changes'),
        title: error.message,
      });
    },
    onSettled: () => {
      if (instanceId) {
        void utils.decision.getInstance.invalidate({ instanceId });
      }
    },
  });

  const handleLaunchOrSave = () => {
    if (isDraft) {
      setIsLaunchModalOpen(true);
    } else {
      updateInstance.mutate({
        instanceId,
        name: storeData?.name || undefined,
        description: storeData?.description || undefined,
        stewardProfileId: storeData?.stewardProfileId || undefined,
        phases: storeData?.phases,
        proposalTemplate: storeData?.proposalTemplate,
        config: storeData?.categories
          ? {
              categories: storeData.categories,
              requireCategorySelection: storeData.requireCategorySelection,
              allowMultipleCategories: storeData.allowMultipleCategories,
            }
          : undefined,
      });
    }
  };

  const handleSelectionChange = (key: Key) => {
    setStep(String(key));
    setOpen(false);
  };

  return (
    <header className="relative sticky top-0 z-20 flex h-14 w-dvw shrink-0 items-center justify-between border-b bg-white">
      <div className="relative z-10 flex items-center gap-2 pl-4 md:pl-8">
        {hasSteps && <SidebarTrigger className="size-4 md:hidden" />}

        <Link
          href="/"
          className="hidden items-center gap-2 text-primary md:flex"
        >
          <LuHouse className="size-4" />
          {t('Home')}
        </Link>
        <LuChevronRight className="hidden size-4 md:block" />

        <span>{displayName}</span>
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
                <Tab
                  key={step.id}
                  id={step.id}
                  className="flex h-full items-center gap-2"
                >
                  {t(step.labelKey)}
                  {step.id === 'rubric' && <ComingSoonIndicator />}
                </Tab>
              ))}
            </TabList>
          </Tabs>
        </nav>
      )}
      <div className="relative z-10 flex gap-4 pr-4 md:pr-8">
        {hasSteps && (
          <div className="flex gap-2">
            {validation.stepsRemaining > 0 && (
              <StepsRemainingPopover validation={validation} />
            )}
            <Button
              className="h-8 rounded-sm"
              onPress={handleLaunchOrSave}
              isDisabled={
                updateInstance.isPending ||
                !validation.isReadyToLaunch ||
                isTerminalStatus
              }
            >
              {isDraft ? (
                <LuPlus className="size-4" />
              ) : (
                <LuSave className="size-4" />
              )}
              <span className="md:hidden">
                {isDraft ? t('Launch') : t('Update')}
              </span>
              <span className="hidden md:inline">
                {isDraft ? t('Launch Process') : t('Update Process')}
              </span>
            </Button>
          </div>
        )}
        <UserAvatarMenu className="hidden md:block" />
      </div>

      {slug && decisionProfileId && (
        <LaunchProcessModal
          isOpen={isLaunchModalOpen}
          onOpenChange={setIsLaunchModalOpen}
          instanceId={instanceId}
          processName={displayName}
          slug={slug}
          decisionProfileId={decisionProfileId}
        />
      )}
    </header>
  );
};

const MobileSidebar = ({ instanceId }: { instanceId?: string }) => {
  const t = useTranslations();
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
                {step.id === 'rubric' && <ComingSoonIndicator />}
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

const StepsRemainingPopover = ({
  validation,
}: {
  validation: ValidationSummary;
}) => {
  const t = useTranslations();

  return (
    <DialogTrigger>
      <Button
        className="flex aspect-square h-8 gap-2 rounded-sm md:aspect-auto"
        color="warn"
      >
        <LuCircleAlert className="size-4 shrink-0" />
        <span className="hidden md:block">
          {t('{stepCount, plural, =1 {1 step} other {# steps}} remaining', {
            stepCount: validation.stepsRemaining,
          })}
        </span>
      </Button>
      <Popover
        placement="bottom end"
        className="w-72 rounded-lg border bg-white p-4 shadow-lg"
      >
        <p className="mb-3 font-medium text-neutral-black">
          {t('Complete these steps to launch')}
        </p>
        <ul className="space-y-3">
          {validation.checklist.map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              {item.isValid ? (
                <LuCheck className="size-5 shrink-0 text-functional-green" />
              ) : (
                <LuCircle className="size-5 shrink-0 text-neutral-gray4" />
              )}
              <span
                className={
                  item.isValid ? 'text-functional-green' : 'text-neutral-black'
                }
              >
                {t(item.labelKey)}
              </span>
            </li>
          ))}
        </ul>
      </Popover>
    </DialogTrigger>
  );
};
