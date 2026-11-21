'use client';

import { trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';

import { useTranslations } from '@/lib/i18n';

/** Saves a change to the process instance, showing the saved process at once and toasting on failure. */
export function useSaveInstance(slug: string) {
  const t = useTranslations('decisions.processAdmin');
  const utils = trpc.useUtils();

  return trpc.decision.updateDecisionInstance.useMutation({
    // Saves to one process run in order, so an earlier save cannot land after a later one.
    scope: { id: `process-admin-save:${slug}` },
    onSuccess: async (saved) => {
      // The response carries no access, steward, owner or process.
      utils.decision.getDecisionBySlug.setData(
        { slug },
        (current) =>
          current && {
            ...current,
            ...saved,
            processInstance: {
              ...current.processInstance,
              ...saved.processInstance,
              access: current.processInstance.access,
            },
          },
      );
      // The realtime channel already refetches; join that fetch instead of restarting it.
      await utils.decision.getDecisionBySlug.invalidate({ slug }, undefined, {
        cancelRefetch: false,
      });
    },
    onError: (error) => {
      logger.error('Process save failed', { error });
      toast.error(t('saveError'));
    },
  });
}
