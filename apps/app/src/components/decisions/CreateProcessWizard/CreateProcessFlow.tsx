'use client';

import { trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { useMutation } from '@tanstack/react-query';

import { useRouter, useTranslations } from '@/lib/i18n';

import { CreateProcessWizard } from '.';
import type { ProcessDraft } from './types';
import {
  clearWizardProgress,
  saveWizardProgress,
  useSavedWizardProgress,
} from './wizardProgress';

export function CreateProcessFlow() {
  const t = useTranslations();
  const tWizard = useTranslations('decisions.createWizard');
  const router = useRouter();
  const utils = trpc.useUtils();
  const savedProgress = useSavedWizardProgress();

  const createProcess = useMutation({
    mutationFn: (draft: ProcessDraft) =>
      utils.client.decision.createInstanceFromWizard.mutate({
        name: draft.name,
        type: draft.type,
        shape: draft.shape,
        phases: draft.pieces.map((piece) => ({
          kind: piece.phaseType,
          name: tWizard(piece.phaseName ?? piece.name),
        })),
      }),
    onSuccess: (decisionProfile) => {
      clearWizardProgress();
      // Not push: Back must not reopen the wizard.
      router.replace(`/decisions/${decisionProfile.slug}/edit`);
    },
    onError: (error) => {
      logger.error('Failed to create a decision process', { error });
      toast.error(t('shell.createDecisionError'));
    },
  });

  const exit = () => {
    clearWizardProgress();

    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  if (savedProgress === undefined) {
    return <div className="h-dvh bg-muted" />;
  }

  return (
    <CreateProcessWizard
      initial={savedProgress}
      onProgressChange={saveWizardProgress}
      onExit={exit}
      onComplete={(draft) => createProcess.mutate(draft)}
      isSubmitting={createProcess.isPending || createProcess.isSuccess}
    />
  );
}
