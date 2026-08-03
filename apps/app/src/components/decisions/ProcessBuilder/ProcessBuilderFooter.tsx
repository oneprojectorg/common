'use client';

import { trpc } from '@op/api/client';
import { ProcessStatus } from '@op/api/encoders';
import { Button } from '@op/sense/Button';
import { SidebarTrigger } from '@op/sense/Sidebar';
import { toast } from '@op/sense/Toast';
import { useState } from 'react';
import { LuAlignJustify, LuArrowRight, LuArrowLeft } from 'react-icons/lu';

import { useRouter, useTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';

import { LaunchProcessModal } from './LaunchProcessModal';
import { useProcessBuilderAutosave } from './ProcessBuilderAutosaveContext';
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
  const navigationConfig = useNavigationConfig(instanceId, decisionProfileId);

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
  const dirtyFields = useProcessBuilderStore((s) => s.dirty[decisionProfileId]);
  const clearInstance = useProcessBuilderStore((s) => s.clearInstance);
  // Published edits stay local until "Update Process" — surface that
  const hasUnsavedChanges =
    !isDraft && !!dirtyFields && Object.keys(dirtyFields).length > 0;
  const displayName =
    storeData?.name || decisionProfile?.name || t('New process');

  const { flushPendingChanges } = useProcessBuilderAutosave();
  const utils = trpc.useUtils();

  const updateInstance = trpc.decision.updateDecisionInstance.useMutation({
    onSuccess: async (data) => {
      toast.success(t('Changes saved successfully'));
      // Clear stale store data so the editor reseeds from fresh server data
      clearInstance(decisionProfileId);
      await utils.decision.getDecisionBySlug.invalidate({ slug });
      if (data.slug !== slug) {
        await utils.decision.getDecisionBySlug.invalidate({ slug: data.slug });
      }
      router.push(`/decisions/${data.slug}`);
    },
    onError: (error) => {
      toast.error(t('Failed to save changes'), {
        description: error.message,
      });
    },
  });

  const handleLaunchOrSave = async () => {
    // Flush any pending autosave so in-flight draft saves complete
    // before launching or updating. For non-draft, this is a no-op
    // but ensures a clean state.
    const flushed = await flushPendingChanges();
    if (!flushed) {
      // Error already toasted by the autosave context's onError callback.
      return;
    }

    if (isDraft) {
      setIsLaunchModalOpen(true);
    } else {
      // Send only edited fields — a full snapshot would overwrite other
      // admins' saved changes. Cleared name/steward are invalid, so they
      // coalesce to undefined (server keeps its value); cleared
      // description is valid and goes through.
      updateInstance.mutate({
        instanceId,
        name: dirtyFields?.name || undefined,
        description: dirtyFields?.description,
        stewardProfileId: dirtyFields?.stewardProfileId || undefined,
        overview: dirtyFields?.overview,
        phases: dirtyFields?.phases,
        proposalTemplate: dirtyFields?.proposalTemplate,
        rubricTemplate: dirtyFields?.rubricTemplate,
        config: dirtyFields?.config,
      });
    }
  };

  return (
    <>
      <footer className="sticky bottom-0 z-20 shrink-0 border-t bg-white/80 px-4 py-2 backdrop-blur sm:px-8">
        {/* Mobile: full-width progress bar overlaying top edge */}
        {isDraft && (
          <ProgressIndicator
            percentage={validation.completionPercentage}
            variant="strip"
          />
        )}
        <div className="flex h-full items-center justify-between md:px-0">
          {/* Left: Exit + Back — matches sidebar width */}
          <div className="flex items-center gap-2 md:w-60 md:shrink-0">
            <ButtonLink variant="ghost" href={`/decisions/${slug}`}>
              {t('Exit')}
            </ButtonLink>
            {hasPrev && (
              <Button
                variant="outline"
                onClick={goBack}
                className="hidden md:inline-flex"
              >
                <LuArrowLeft className="rtl:-scale-x-100" />
                {t('Back')}
              </Button>
            )}
          </div>

          {/* Center + Right: content-width area after sidebar */}
          <div className="hidden justify-end md:flex md:flex-1 md:items-center">
            {/* Progress bar constrained to content width, centered like page content */}
            {isDraft && (
              <ProgressIndicator
                percentage={validation.completionPercentage}
                variant="bar"
              />
            )}
            {/* Desktop action buttons */}
            <div className="flex shrink-0 items-center gap-2">
              {hasUnsavedChanges && (
                <span className="text-sm text-neutral-gray4">
                  {t('Unsaved changes')}
                </span>
              )}
              {hasNext && (
                <Button variant="outline" onClick={goNext}>
                  {t('Next')}
                  <LuArrowRight className="rtl:-scale-x-100" />
                </Button>
              )}

              {(!isDraft ||
                (validation.isReadyToLaunch && !isTerminalStatus)) && (
                <Button
                  onClick={handleLaunchOrSave}
                  disabled={updateInstance.isPending}
                >
                  {isDraft ? t('Launch Process') : t('Update Process')}
                </Button>
              )}
            </div>
          </div>

          {/* Mobile: Menu + Back + Next + Launch */}
          <div className="flex items-center justify-end gap-2 md:hidden">
            <SidebarTrigger
              aria-label={t('Open process steps')}
              variant="outline"
              size="icon"
            >
              <LuAlignJustify />
            </SidebarTrigger>
            {hasPrev && (
              <Button variant="outline" onClick={goBack}>
                {t('Back')}
              </Button>
            )}
            {hasNext && (
              <Button variant="outline" onClick={goNext}>
                {t('Next')}
              </Button>
            )}
            {(!isDraft ||
              (validation.isReadyToLaunch && !isTerminalStatus)) && (
              <Button
                onClick={handleLaunchOrSave}
                disabled={updateInstance.isPending}
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
        decisionProfileId={decisionProfileId}
      />
    </>
  );
};
