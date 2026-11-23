'use client';

import { trpc } from '@op/api/client';
import type { CustomFormWithPhaseDTO } from '@op/common/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  CustomFormModal,
  type CustomFormValues,
} from './proposalEditor/CustomFormModal';
import {
  hasFormSkipCookie,
  setFormSkipCookie,
} from './formSkipCookie';

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
  const searchParams = useSearchParams();
  // The post-publish success modal owns the screen while `?resultsLive=1` is in
  // the URL. Holding the form back until that param is stripped prevents the
  // form's backdrop from intercepting clicks on the success modal.
  const isResultsLiveDialogActive = searchParams.get('resultsLive') === '1';

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
  const [skipped, setSkipped] = useState(
    () => hasFormSkipCookie(currentPhaseId),
  );
  const [submitted, setSubmitted] = useState(false);

  const { data: form } = trpc.customForm.getForProfile.useQuery(
    {
      profileId,
      phaseId: currentPhaseId,
      initialPhaseId,
    },
    { retry: false, staleTime: Infinity, enabled: !skipped },
  );

  const shouldShow = useMemo(() => {
    if (!form || skipped || submitted) {
      return false;
    }

    const schema = form.schema as Record<string, unknown>;
    const showOnPhaseEntry = schema['x-show-on-phase-entry'] === true;

    return showOnPhaseEntry;
  }, [form, skipped, submitted]);

  if (!shouldShow) {
    return null;
  }

  return (
    <CustomFormModalWrapper
      form={form}
      profileId={profileId}
      currentPhaseId={currentPhaseId}
      onSkip={() => {
        setFormSkipCookie(currentPhaseId);
        setSkipped(true);
      }}
      onSubmitted={() => {
        setSubmitted(true);
      }}
    />
  );
}

function CustomFormModalWrapper({
  form,
  profileId,
  currentPhaseId,
  onSkip,
  onSubmitted,
}: {
  form: CustomFormWithPhaseDTO;
  profileId: string;
  currentPhaseId: string;
  onSkip: () => void;
  onSubmitted: () => void;
}) {
  const t = useTranslations('decisions.proposals');
  const submitCustomForm = trpc.customForm.submit.useMutation();

  const handleSubmit = async (values: CustomFormValues) => {
    try {
      await submitCustomForm.mutateAsync({
        customFormId: form.id,
        profileId,
        data: values,
      });
      onSubmitted();
    } catch (error) {
      logger.error('Failed to submit phase entry custom form', {
        error,
        context: 'PhaseEntryCustomForm.handleSubmit',
      });
      toast.error(t('submitFormError'));
    }
  };

  return (
    <CustomFormModal
      isOpen={true}
      customFormId={form.id}
      schema={form.schema}
      isSubmitting={submitCustomForm.isPending}
      onSubmit={handleSubmit}
      onOpenChange={(open) => {
        if (!open && !submitCustomForm.isPending) {
          onSkip();
        }
      }}
    />
  );
}
