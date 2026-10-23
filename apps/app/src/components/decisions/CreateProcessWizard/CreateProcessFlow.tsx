'use client';

import { trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

import { useRouter, useTranslations } from '@/lib/i18n';

import { CreateProcessWizard } from '.';
import type { WizardState } from './flow';
import type { ProcessDraft } from './types';
import {
  clearWizardProgress,
  saveWizardProgress,
  takeWizardOrigin,
  useSavedWizardProgress,
} from './wizardProgress';

export function CreateProcessFlow() {
  const t = useTranslations();
  const tWizard = useTranslations('decisions.createWizard');
  const router = useRouter();
  const utils = trpc.useUtils();
  const savedProgress = useSavedWizardProgress();
  const progress = useRef<WizardState | null>(null);

  const createProcess = useMutation({
    mutationFn: (draft: ProcessDraft) =>
      utils.client.decision.createInstance.mutate({
        name: draft.name,
        type: draft.type,
        phases: draft.phases.map((phase) => ({
          kind: phase.kind,
          name: tWizard(phase.phaseName),
        })),
      }),
    onError: (error) => {
      logger.error('Failed to create a decision process', { error });
    },
  });

  const saveProgress = useCallback((next: WizardState) => {
    progress.current = next;
    saveWizardProgress(next);
  }, []);

  const submit = (draft: ProcessDraft) => {
    // Cleared before the request, so a reload mid-flight cannot resubmit.
    clearWizardProgress();

    // Per-call callbacks run only while this component is still mounted.
    createProcess.mutate(draft, {
      onSuccess: (decisionProfile) => {
        // Not push: Back must not reopen the wizard.
        router.replace(`/decisions/${decisionProfile.slug}/edit`);
      },
      onError: () => {
        if (progress.current) {
          saveWizardProgress(progress.current);
        }

        toast.error(t('shell.createDecisionError'));
      },
    });
  };

  const exit = () => {
    clearWizardProgress();
    router.push(takeWizardOrigin() ?? '/');
  };

  if (savedProgress === undefined) {
    return <div className="h-dvh bg-muted" />;
  }

  return (
    <CreateProcessWizard
      initial={savedProgress}
      onProgressChange={saveProgress}
      onExit={exit}
      onComplete={submit}
      isSubmitting={createProcess.isPending || createProcess.isSuccess}
    />
  );
}
