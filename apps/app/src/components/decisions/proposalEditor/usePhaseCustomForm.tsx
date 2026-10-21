'use client';

import { trpc } from '@op/api/client';
import type { CustomForm } from '@op/api/encoders';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { useCallback, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { CustomFormModal, type CustomFormValues } from './CustomFormModal';

/**
 * Opens the phase's custom form before `onSubmit` when the caller still owes
 * it, attaching the answers to `targetProfileId`. Dismissing it cancels.
 */
export function usePhaseCustomForm({
  processInstanceId,
  phaseId,
  targetProfileId,
  submitLabel,
  onSubmit,
}: {
  processInstanceId: string;
  phaseId: string;
  targetProfileId?: string;
  submitLabel: string;
  onSubmit: () => Promise<void>;
}) {
  const t = useTranslations('decisions.proposals');
  const utils = trpc.useUtils();
  const submitCustomForm = trpc.customForm.submit.useMutation();
  const [form, setForm] = useState<CustomForm | null>(null);

  // The action stays in flight from the trigger until `onSubmit` settles or the
  // form is dismissed, so a second trigger cannot run it twice.
  const inFlightRef = useRef(false);
  const [isSubmittingWithCustomForm, setIsSubmittingWithCustomForm] =
    useState(false);

  const setInFlight = useCallback((inFlight: boolean) => {
    inFlightRef.current = inFlight;
    setIsSubmittingWithCustomForm(inFlight);
  }, []);

  const submitWithCustomForm = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }
    setInFlight(true);

    let owedForm: CustomForm | null = null;
    try {
      const instance = await utils.decision.getInstance.ensureData({
        instanceId: processInstanceId,
      });
      if (instance.profileId) {
        owedForm = await utils.customForm.getForProfile.fetch({
          profileId: instance.profileId,
          phaseId,
          initialPhaseId: instance.instanceData?.phases?.[0]?.phaseId,
        });
      }
    } catch (error) {
      logger.error('Failed to load the phase custom form', {
        error,
        context: 'usePhaseCustomForm.submitWithCustomForm',
      });
      toast.error(t('submitFormError'));
      setInFlight(false);
      return;
    }

    if (owedForm) {
      setForm(owedForm);
      return;
    }

    try {
      await onSubmit();
    } finally {
      setInFlight(false);
    }
  }, [utils, processInstanceId, phaseId, onSubmit, t, setInFlight]);

  const handleModalSubmit = async (values: CustomFormValues) => {
    if (!form) {
      return;
    }
    try {
      if (!targetProfileId) {
        throw new Error('No profile to attach the custom form answers to');
      }
      await submitCustomForm.mutateAsync({
        customFormId: form.id,
        profileId: targetProfileId,
        data: values,
      });
    } catch (error) {
      logger.error('Failed to submit the phase custom form', {
        error,
        context: 'usePhaseCustomForm.handleModalSubmit',
      });
      toast.error(t('submitFormError'));
      return;
    }
    setForm(null);
    try {
      await onSubmit();
    } finally {
      setInFlight(false);
    }
  };

  const handleModalOpenChange = (open: boolean) => {
    if (!open && !submitCustomForm.isPending) {
      setForm(null);
      setInFlight(false);
    }
  };

  const customFormModal = form ? (
    <CustomFormModal
      isOpen
      schema={form.schema}
      isSubmitting={submitCustomForm.isPending}
      onSubmit={handleModalSubmit}
      onOpenChange={handleModalOpenChange}
      submitLabel={submitLabel}
    />
  ) : null;

  return { submitWithCustomForm, isSubmittingWithCustomForm, customFormModal };
}
