'use client';

import { trpc } from '@op/api/client';
import { ProcessStatus } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { DialogTrigger } from '@op/ui/Dialog';
import { Popover } from '@op/ui/Popover';
import { toast } from '@op/ui/Toast';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  LuArrowLeft,
  LuArrowRight,
  LuCheck,
  LuCircle,
  LuCircleAlert,
  LuLogOut,
  LuPlus,
  LuSave,
} from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import { LaunchProcessModal } from './LaunchProcessModal';
import { useProcessBuilderStore } from './stores/useProcessBuilderStore';
import { useNavigationConfig } from './useNavigationConfig';
import { useProcessNavigation } from './useProcessNavigation';
import type { ValidationSummary } from './validation/processBuilderValidation';
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
      return storePhases
        .map((p) => ({ phaseId: p.phaseId, name: p.name ?? '' }))
        .filter((p) => p.name);
    }
    const instancePhases = instance?.instanceData?.phases;
    if (instancePhases?.length) {
      return instancePhases
        .map((p) => ({ phaseId: p.phaseId, name: p.name ?? '' }))
        .filter((p) => p.name);
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
      <footer className="sticky bottom-0 z-20 grid h-14 shrink-0 grid-cols-3 items-center border-t bg-white/80 px-4 backdrop-blur md:px-8">
        <div className="flex items-center gap-2">
          <Link
            href={`/decisions/${slug}`}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-neutral-gray2 px-3 text-sm text-charcoal transition-colors hover:bg-neutral-gray1"
          >
            <LuLogOut className="size-4 rotate-180" />
            {t('Exit')}
          </Link>
          {hasPrev && (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-gray2 px-3 text-sm text-primary transition-colors hover:bg-neutral-gray1"
            >
              <LuArrowLeft className="size-4" />
              {t('Back')}
            </button>
          )}
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className="h-1 w-full max-w-48 overflow-hidden rounded-full bg-neutral-gray2">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${validation.completionPercentage}%`,
                backgroundImage:
                  'linear-gradient(to right, #3EC300, #0396A6)',
              }}
            />
          </div>
          <span className="hidden text-xs text-neutral-gray4 md:block">
            {t('{count}% complete', {
              count: validation.completionPercentage,
            })}
          </span>
        </div>

        <div className="flex items-center justify-end gap-2">
          {hasNext && (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-gray2 px-3 text-sm text-primary transition-colors hover:bg-neutral-gray1"
            >
              {t('Next')}
              <LuArrowRight className="size-4" />
            </button>
          )}
          {validation.stepsRemaining > 0 && (
            <StepsRemainingPopover validation={validation} />
          )}
          <Button
            className="h-8 rounded-md"
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

const StepsRemainingPopover = ({
  validation,
}: {
  validation: ValidationSummary;
}) => {
  const t = useTranslations();

  return (
    <DialogTrigger>
      <Button
        className="flex aspect-square h-8 gap-2 rounded-md md:aspect-auto"
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
        placement="top end"
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
