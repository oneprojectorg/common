'use client';

import { useRequiredUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { useMutation } from '@tanstack/react-query';

import { useRouter, useTranslations } from '@/lib/i18n';

import { CreateProcessWizard } from '.';
import type { ProcessDraft } from './types';

// Only the name and steward persist until phases are rows; the process still
// comes from the first template.
export function CreateProcessFlow() {
  const t = useTranslations();
  const router = useRouter();
  const utils = trpc.useUtils();
  const { user } = useRequiredUser();

  const createProcess = useMutation({
    mutationFn: async (draft: ProcessDraft) => {
      const { processes: templates } =
        await utils.decision.listProcesses.ensureData({ limit: 1 });
      const [firstTemplate] = templates;

      if (!firstTemplate) {
        throw new Error('No decision process templates available');
      }

      return utils.client.decision.createInstanceFromTemplate.mutate({
        templateId: firstTemplate.id,
        name: draft.name,
        stewardProfileId: draft.stewardProfileId || undefined,
      });
    },
    onSuccess: (decisionProfile) => {
      // `replace`, so Back can't reopen the wizard and create a second process.
      router.replace(`/decisions/${decisionProfile.slug}/edit`);
    },
    onError: (error) => {
      logger.error('Failed to create a decision process', { error });
      toast.error(t('shell.createDecisionError'));
    },
  });

  const exit = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  const defaultStewardProfileId =
    user.currentProfile?.id ?? user.profileId ?? '';

  return (
    <CreateProcessWizard
      defaultStewardProfileId={defaultStewardProfileId}
      onExit={exit}
      onComplete={(draft) => createProcess.mutate(draft)}
      isSubmitting={createProcess.isPending || createProcess.isSuccess}
    />
  );
}
