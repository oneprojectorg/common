'use client';

import { useRequiredUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { toast } from '@op/sense/Toast';
import { useMutation } from '@tanstack/react-query';

import { useRouter, useTranslations } from '@/lib/i18n';

import { CreateProcessWizard } from '.';
import type { ProcessDraft } from './types';

/**
 * Wires the wizard to the product.
 *
 * Only the name and the steward survive today: `type` and `shape` are inputs to
 * the mapping and persist nothing, and the resolved pieces need phases to be
 * rows before they have anywhere to go (slice 2 of
 * `docs/process-setup-port.wrk.md`). Until then a process is still created from
 * the first template, as the Create menu did before this flow existed.
 */
export function CreateProcessFlow() {
  const t = useTranslations();
  const router = useRouter();
  const utils = trpc.useUtils();
  const { user } = useRequiredUser();

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
        stewardProfileId: draft.stewardProfileId || undefined,
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
    // A direct visit has no history to go back to.
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
      // Stays busy after success too: the redirect is still in flight.
      isSubmitting={createProcess.isPending || createProcess.isSuccess}
    />
  );
}
