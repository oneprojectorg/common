'use client';

import { trpc } from '@op/api/client';
import type { CustomFormWithPhaseDTO } from '@op/common/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { useQueryState } from 'nuqs';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { hasFormSkipCookie, setFormSkipCookie } from './formSkipCookie';
import {
  CustomFormModal,
  type CustomFormValues,
} from './proposalEditor/CustomFormModal';

interface PhaseEntryCustomFormProps {
  profileId: string;
  currentPhaseId: string | undefined;
  initialPhaseId: string | undefined;
}

export const PhaseEntryCustomForm = ({
  profileId,
  currentPhaseId,
  initialPhaseId,
}: PhaseEntryCustomFormProps) => {
  const [resultsLive] = useQueryState('resultsLive');
  // The post-publish success modal owns the screen. Holding the form back
  // until that param is stripped prevents the form's backdrop from
  // intercepting clicks on the success modal.
  const isResultsLiveDialogActive = resultsLive === '1';

  if (!currentPhaseId || isResultsLiveDialogActive) {
    return null;
  }

  return (
    <PhaseEntryCustomFormInner
      profileId={profileId}
      currentPhaseId={currentPhaseId}
      initialPhaseId={initialPhaseId}
    />
  );
};

function PhaseEntryCustomFormInner({
  profileId,
  currentPhaseId,
  initialPhaseId,
}: PhaseEntryCustomFormProps) {
  const t = useTranslations('decisions.proposals');
  const [submitted, setSubmitted] = useState(false);

  const { data: form } = trpc.customForm.getForProfile.useQuery(
    {
      profileId,
      phaseId: currentPhaseId,
      initialPhaseId,
    },
    { enabled: !submitted },
  );

  if (!form || submitted) {
    return null;
  }

  const schema = form.schema as Record<string, unknown>;
  const showOnPhaseEntry = schema['x-show-on-phase-entry'] === true;

  if (!showOnPhaseEntry || hasFormSkipCookie(form.id)) {
    return null;
  }

  return (
    <CustomFormModalWrapper
      form={form}
      profileId={profileId}
      onSubmitted={() => {
        setSubmitted(true);
      }}
    />
  );
}

function CustomFormModalWrapper({
  form,
  profileId,
  onSubmitted,
}: {
  form: CustomFormWithPhaseDTO;
  profileId: string;
  onSubmitted: () => void;
}) {
  const t = useTranslations('decisions.proposals');
  const utils = trpc.useUtils();
  const submitCustomForm = trpc.customForm.submit.useMutation({
    onSuccess: async () => {
      await utils.customForm.getForProfile.invalidate({ profileId });
      onSubmitted();
    },
    onError: (error) => {
      logger.error('Failed to submit phase entry custom form', {
        error,
        context: 'PhaseEntryCustomForm.handleSubmit',
      });
      toast.error(t('submitFormError'));
    },
  });

  const handleSubmit = (values: CustomFormValues) => {
    submitCustomForm.mutate({
      customFormId: form.id,
      profileId,
      data: values,
    });
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !submitCustomForm.isPending) {
      setFormSkipCookie(form.id);
    }
  };

  return (
    <CustomFormModal
      isOpen={true}
      customFormId={form.id}
      schema={form.schema}
      isSubmitting={submitCustomForm.isPending}
      onSubmit={handleSubmit}
      onOpenChange={handleOpenChange}
    />
  );
}
