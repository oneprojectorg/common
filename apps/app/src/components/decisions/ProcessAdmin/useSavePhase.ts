'use client';

import { trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';

import { useTranslations } from '@/lib/i18n';

/** Saves one phase, showing the saved name at once and toasting the outcome. */
export function useSavePhase(slug: string) {
  const t = useTranslations('decisions.processAdmin');
  const utils = trpc.useUtils();

  return trpc.decision.updatePhase.useMutation({
    scope: { id: `process-admin-save:${slug}` },
    onSuccess: async (saved) => {
      utils.decision.getDecisionBySlug.setData(
        { slug },
        (current) =>
          current && {
            ...current,
            processInstance: {
              ...current.processInstance,
              phases: current.processInstance.phases.map((phase) =>
                phase.id === saved.id ? { ...phase, name: saved.name } : phase,
              ),
            },
          },
      );
      toast.success(t('phaseSaved'));
      await utils.decision.getDecisionBySlug.invalidate({ slug }, undefined, {
        cancelRefetch: false,
      });
    },
    onError: (error) => {
      logger.error('Phase save failed', { error });
      toast.error(t('saveError'));
    },
  });
}
