'use client';

import { trpc } from '@op/api/client';
import { ProcessStatus } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { toast } from '@op/ui/Toast';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { LuLogOut, LuSave } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { LaunchProcessModal } from './LaunchProcessModal';
import { useProcessBuilderStore } from './stores/useProcessBuilderStore';
import { useNavigationConfig } from './useNavigationConfig';
import { useProcessNavigation } from './useProcessNavigation';
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

  const storePhases = useProcessBuilderStore((s) =>
    decisionProfileId ? s.instances[decisionProfileId]?.phases : undefined,
  );

  const { data: instance } = trpc.decision.getInstance.useQuery(
    { instanceId },
    { enabled: !!instanceId },
  );

  const phases = useMemo(() => {
    if (storePhases?.length) {
      return storePhases.map((p) => ({
        phaseId: p.phaseId,
        name: p.name ?? '',
      }));
    }
    const instancePhases = instance?.instanceData?.phases;
    if (instancePhases?.length) {
      return instancePhases.map((p) => ({
        phaseId: p.phaseId,
        name: p.name ?? '',
      }));
    }
    const templatePhases = instance?.process?.processSchema?.phases;
    if (templatePhases?.length) {
      return templatePhases.map((p) => ({ phaseId: p.id, name: p.name }));
    }
    return [];
  }, [storePhases, instance]);

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
        message: t('Failed to save changes'),
        title: error.message,
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
        <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-neutral-gray2 md:hidden">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${validation.completionPercentage}%`,
              backgroundImage: 'linear-gradient(to right, #3EC300, #0396A6)',
            }}
          />
        </div>

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
              <button
                type="button"
                onClick={goBack}
                className="hidden h-10 items-center justify-center rounded-lg border border-neutral-gray1 px-3 text-sm text-primary shadow-[0px_0px_16px_0px_rgba(20,35,38,0.04)] transition-colors hover:bg-neutral-gray1 md:inline-flex"
              >
                {t('Back')}
              </button>
            )}
          </div>

          {/* Center + Right: content-width area after sidebar */}
          <div className="hidden md:flex md:flex-1 md:items-center">
            {/* Progress bar constrained to content width, centered like page content */}
            <div className="mx-auto flex w-full max-w-160 items-center gap-4">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-gray2">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${validation.completionPercentage}%`,
                    backgroundImage:
                      'linear-gradient(to right, #3EC300, #0396A6)',
                  }}
                />
              </div>
              <span
                className="shrink-0 bg-clip-text text-base text-transparent"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, #3EC300, #0396A6)',
                }}
              >
                {t('{count}% complete', {
                  count: validation.completionPercentage,
                })}
              </span>
            </div>

            {/* Desktop action buttons */}
            <div className="flex shrink-0 items-center gap-2">
              {hasNext && (
                <button
                  type="button"
                  onClick={goNext}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-neutral-gray1 px-3 text-sm text-primary shadow-[0px_0px_16px_0px_rgba(20,35,38,0.04)] transition-colors hover:bg-neutral-gray1"
                >
                  {t('Next')}
                </button>
              )}
              {(!isDraft ||
                (validation.isReadyToLaunch && !isTerminalStatus)) && (
                <Button
                  className="h-8 rounded-md"
                  onPress={handleLaunchOrSave}
                  isDisabled={updateInstance.isPending}
                >
                  {!isDraft && <LuSave className="size-4" />}
                  <span className="hidden md:inline">
                    {isDraft ? t('Launch Process') : t('Update Process')}
                  </span>
                </Button>
              )}
            </div>
          </div>

          {/* Mobile: Back + Next + Launch */}
          <div className="flex items-center justify-end gap-2 md:hidden">
            {hasPrev && (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-neutral-gray1 px-3 text-sm text-primary shadow-[0px_0px_16px_0px_rgba(20,35,38,0.04)] transition-colors hover:bg-neutral-gray1"
              >
                {t('Back')}
              </button>
            )}
            {hasNext && (
              <button
                type="button"
                onClick={goNext}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-neutral-gray1 px-3 text-sm text-primary shadow-[0px_0px_16px_0px_rgba(20,35,38,0.04)] transition-colors hover:bg-neutral-gray1"
              >
                {t('Next')}
              </button>
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
