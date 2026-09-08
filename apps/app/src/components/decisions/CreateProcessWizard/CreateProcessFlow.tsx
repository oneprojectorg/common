'use client';

import { trpc } from '@op/api/client';
import { toast } from '@op/sense/Toast';
import { useMutation } from '@tanstack/react-query';

import { useRouter, useTranslations } from '@/lib/i18n';

import { CreateProcessWizard } from '.';
import type { ProcessDraft } from './types';

/**
 * Wires the wizard to the product: creates the process when the last step is
 * confirmed, then hands off to the process page.
 *
 * Slice 1 persists the **name** only. The rest of the draft — type, shape,
 * audience, submissions privacy and the resolved phase mapping — is collected
 * and handed over here, but there is nowhere to store it until the process page
 * (slice 2) and the phase setup pages (slice 3) can consume it. Until then a
 * process is still created from the first template, exactly as the Create menu
 * did before this flow existed.
 */
export function CreateProcessFlow() {
  const t = useTranslations();
  const router = useRouter();
  const utils = trpc.useUtils();

  const createProcess = useMutation({
    mutationFn: async (draft: ProcessDraft) => {
      const { processes: templates } =
        await utils.decision.listProcesses.ensureData({});
      const [firstTemplate] = templates;

      if (!firstTemplate) {
        throw new Error('No decision process templates available');
      }

      return utils.client.decision.createInstanceFromTemplate.mutate({
        templateId: firstTemplate.id,
        name: draft.name,
      });
    },
    onSuccess: (decisionProfile) => {
      router.push(`/decisions/${decisionProfile.slug}/edit`);
    },
    onError: () => {
      toast.error(t('Failed to create decision'));
    },
  });

  const exit = () => {
    // Back where they opened the Create menu from. A direct visit has no
    // history to go back to, so fall back to the home feed.
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  return (
    <CreateProcessWizard
      onExit={exit}
      onComplete={(draft) => createProcess.mutate(draft)}
      // Stays busy after success too: the redirect is still in flight.
      isSubmitting={createProcess.isPending || createProcess.isSuccess}
    />
  );
}
