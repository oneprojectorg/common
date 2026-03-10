'use client';

import { trpc } from '@op/api/client';
import { ProcessStatus } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { SidebarTrigger } from '@op/ui/Sidebar';
import { toast } from '@op/ui/Toast';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LuLogOut } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { LaunchProcessModal } from './LaunchProcessModal';
import { ProgressIndicator } from './components/ProgressIndicator';
import { useProcessBuilderStore } from './stores/useProcessBuilderStore';
import { useNavigationConfig } from './useNavigationConfig';
import { useProcessNavigation } from './useProcessNavigation';
import { useProcessPhases } from './useProcessPhases';
import { useProcessBuilderValidation } from './validation/useProcessBuilderValidation';

export const ProcessBuilderFooter = ({
  instanceId,
  slug,
  decisionProfileId,
}: {
  instanceId: string;
  slug: string;
  decisionProfileId: string;
}) => {
  const t = useTranslations();
  const router = useRouter();
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);

  const validation = useProcessBuilderValidation(decisionProfileId);
  const navigationConfig = useNavigationConfig(instanceId);

  const phases = useProcessPhases(instanceId, decisionProfileId);

  const { goNext, goBack, hasNext, hasPrev } = useProcessNavigation(
    navigationConfig,
    phases,
  );

  const { data: decisionProfile } = trpc.decision.getDecisionBySlug.useQuery(
    { slug },
    { enabled: !!slug },
  );

  const processInstance = decisionProfile?.processInstance;
  const instanceStatus = processInstance?.status as ProcessStatus | undefined;
  const isDraft = instanceStatus === ProcessStatus.DRAFT;
  const isTerminalStatus =
    instanceStatus === ProcessStatus.COMPLETED ||
    instanceStatus === ProcessStatus.CANCELLED;

  const storeData = useProcessBuilderStore(
    (s) => s.instances[decisionProfileId],
  );
  const displayName =
    storeData?.name || decisionProfile?.name || t('New process');

  const utils = trpc.useUtils();

  const updateInstance = trpc.decision.updateDecisionInstance.useMutation({
    onSuccess: () => {
      toast.success({ message: t('Changes saved successfully') });
      router.push(`/decisions/${slug}`);
    },
    onError: (error) => {
      toast.error({
        title: t('Failed to save changes'),
        message: error.message,
      });
    },
    onSettled: () => {
      void utils.decision.getDecisionBySlug.invalidate({ slug });
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
        config: storeData?.config,
      });
    }
  };

  return (
    <>
      <footer className="sticky bottom-0 z-20 shrink-0 border-t bg-white/80 px-8 py-2 backdrop-blur">
        {/* Mobile: full-width progress bar overlaying top edge */}
        <ProgressIndicator
          percentage={validation.completionPercentage}
          variant="strip"
        />

        <div className="flex h-full items-center justify-between md:px-0">
          {/* Left: Exit + Back — matches sidebar width */}
          <div className="flex items-center gap-2 md:w-60 md:shrink-0">
            <Link
              href={`/decisions/${slug}`}
              className="inline-flex h-10 items-center gap-1 px-2 text-base text-charcoal transition-colors hover:bg-neutral-gray1"
            >
              <LuLogOut className="size-4 rotate-180" />
              {t('Exit')}
            </Link>
            {hasPrev && (
              <Button
                color="secondary"
                onPress={goBack}
                className="hidden md:inline-flex"
              >
                {t('Back')}
              </Button>
            )}
          </div>

          {/* Center + Right: content-width area after sidebar */}
          <div className="hidden md:flex md:flex-1 md:items-center">
            {/* Progress bar constrained to content width, centered like page content */}
            <ProgressIndicator
              percentage={validation.completionPercentage}
              variant="bar"
            />

            {/* Desktop action buttons */}
            <div className="flex shrink-0 items-center gap-2">
              {hasNext && (
                <Button color="secondary" onPress={goNext}>
                  {t('Next')}
                </Button>
              )}

              {(!isDraft ||
                (validation.isReadyToLaunch && !isTerminalStatus)) && (
                <Button
                  onPress={handleLaunchOrSave}
                  isDisabled={updateInstance.isPending}
                >
                  {isDraft ? t('Launch Process') : t('Update Process')}
                </Button>
              )}
            </div>
          </div>

          {/* Mobile: Menu + Back + Next + Launch */}
          <div className="flex items-center justify-end gap-2 md:hidden">
            <SidebarTrigger />
            {hasPrev && (
              <Button color="secondary" onPress={goBack}>
                {t('Back')}
              </Button>
            )}
            {hasNext && (
              <Button color="secondary" onPress={goNext}>
                {t('Next')}
              </Button>
            )}
            {(!isDraft ||
              (validation.isReadyToLaunch && !isTerminalStatus)) && (
              <Button
                className="h-8 rounded-md"
                onPress={handleLaunchOrSave}
                isDisabled={updateInstance.isPending}
              >
                {isDraft ? t('Launch') : t('Update')}
              </Button>
            )}
          </div>
        </div>
      </footer>

      <LaunchProcessModal
        isOpen={isLaunchModalOpen}
        onOpenChange={setIsLaunchModalOpen}
        instanceId={instanceId}
        processName={displayName}
        slug={slug}
        decisionProfileId={decisionProfileId}
      />
    </>
  );
};
