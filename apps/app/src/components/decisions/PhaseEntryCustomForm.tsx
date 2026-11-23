'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { CustomForm } from '@op/api/encoders';
import { getFormShowOn } from '@op/common/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { useQueryState } from 'nuqs';
import { useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { QUERY_PARAM as RESULTS_LIVE_QUERY_PARAM } from './FinalPhaseSubmissionSuccessDialog';
import {
  CustomFormModal,
  type CustomFormValues,
} from './proposalEditor/CustomFormModal';
import { hasSkipCookie, setSkipCookie } from './skipCookie';

interface PhaseEntryCustomFormProps {
  decisionProfileId: string;
  currentPhaseId: string;
  initialPhaseId?: string;
}

/** Opens the current phase's custom form when it is set to show on entry. */
export const PhaseEntryCustomForm = (props: PhaseEntryCustomFormProps) => {
  const [resultsLive] = useQueryState(RESULTS_LIVE_QUERY_PARAM);
  const { user } = useUser();
  // The post-publish success modal owns the screen while `?resultsLive=1` is in
  // the URL, so the form waits until that param is stripped.
  const isResultsLiveDialogActive = resultsLive === '1';

  if (!user?.profileId || isResultsLiveDialogActive) {
    return null;
  }

  return (
    <PhaseEntryCustomFormQuery
      {...props}
      participantProfileId={user.profileId}
    />
  );
};

function PhaseEntryCustomFormQuery({
  decisionProfileId,
  currentPhaseId,
  initialPhaseId,
  participantProfileId,
}: PhaseEntryCustomFormProps & { participantProfileId: string }) {
  const [isClosed, setIsClosed] = useState(false);
  const { data: form } = trpc.customForm.getForProfile.useQuery({
    profileId: decisionProfileId,
    phaseId: currentPhaseId,
    initialPhaseId,
  });

  if (
    isClosed ||
    !form ||
    getFormShowOn(form.schema) !== 'entry' ||
    hasSkipCookie(getFormSkipCookieName(form.id))
  ) {
    return null;
  }

  return (
    <PhaseEntryCustomFormModal
      form={form}
      participantProfileId={participantProfileId}
      onClose={() => setIsClosed(true)}
    />
  );
}

function PhaseEntryCustomFormModal({
  form,
  participantProfileId,
  onClose,
}: {
  form: CustomForm;
  participantProfileId: string;
  onClose: () => void;
}) {
  const t = useTranslations('decisions.proposals');
  const submitForm = trpc.customForm.submit.useMutation({
    onSuccess: onClose,
    onError: (error) => {
      logger.error('Failed to submit phase entry custom form', {
        error,
        customFormId: form.id,
      });
      toast.error(t('submitFormError'));
    },
  });

  const handleModalSubmit = (values: CustomFormValues) => {
    submitForm.mutate({
      customFormId: form.id,
      profileId: participantProfileId,
      data: values,
    });
  };

  const handleModalOpenChange = (open: boolean) => {
    if (open || submitForm.isPending) {
      return;
    }
    setSkipCookie(getFormSkipCookieName(form.id));
    onClose();
  };

  return (
    <CustomFormModal
      isOpen
      customFormId={form.id}
      schema={form.schema}
      isSubmitting={submitForm.isPending}
      onSubmit={handleModalSubmit}
      onOpenChange={handleModalOpenChange}
    />
  );
}

const getFormSkipCookieName = (formId: string) => `form-skipped-${formId}`;
