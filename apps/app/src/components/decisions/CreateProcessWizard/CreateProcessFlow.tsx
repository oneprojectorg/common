'use client';

import { trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

import { useRouter, useTranslations } from '@/lib/i18n';

import { CreateProcessWizard } from './CreateProcessWizard';
import type { WizardState } from './flow';
import type { ProcessDraft } from './types';
import {
  clearWizardOrigin,
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
  const isSubmitting = useRef(false);

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
    // Hook-level, so leaving the page mid-request still lands on the process.
    onSuccess: (decisionProfile) => {
      clearWizardOrigin();
      // Not push: Back must not reopen the wizard.
      router.replace(`/decisions/${decisionProfile.slug}/edit`);
    },
    onError: (error) => {
      logger.error('Failed to create a decision process', { error });
    },
  });

  const saveProgress = useCallback((next: WizardState) => {
    // Not while a request is in flight: a save would undo the clear below.
    if (isSubmitting.current) {
      return;
    }

    progress.current = next;
    saveWizardProgress(next);
  }, []);

  const submit = (draft: ProcessDraft) => {
    // Cleared before the request, so a reload mid-flight cannot resubmit.
    isSubmitting.current = true;
    clearWizardProgress();

    // Per-call, so it runs only while this screen is still mounted.
    createProcess.mutate(draft, {
      onError: () => {
        isSubmitting.current = false;

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
