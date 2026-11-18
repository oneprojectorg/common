'use client';

import { trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';

import { useTranslations } from '@/lib/i18n';

/** Saves a change to the process instance, refetching the page's process and toasting on failure. */
export function useSaveInstance(slug: string) {
  const t = useTranslations('decisions.processAdmin');
  const utils = trpc.useUtils();

  return trpc.decision.updateDecisionInstance.useMutation({
    onSuccess: async () => {
      await utils.decision.getDecisionBySlug.invalidate({ slug });
    },
    onError: (error) => {
      logger.error('Process save failed', { error });
      toast.error(t('saveError'));
    },
  });
}
