'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { CustomForm } from '@op/api/encoders';
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

/** Opens the current phase's custom form when it is set to open on entry. */
export const PhaseEntryCustomForm = ({
  instanceId,
}: {
  instanceId: string;
}) => {
  const { user } = useUser();
  // The live instance, not layout props, so a phase change opens its form.
  const { data: instance } = trpc.decision.getInstance.useQuery({ instanceId });
  const [resultsLive] = useQueryState(RESULTS_LIVE_QUERY_PARAM);
  const [closedFormId, setClosedFormId] = useState<string>();
  // The lookup asserts read access, so a viewer without it never asks.
  const participantProfileId = instance?.access?.read
    ? user?.profileId
    : undefined;
  const decisionProfileId = instance?.profileId;
  const currentPhaseId = instance?.currentStateId;
  // The post-publish success modal owns the screen while `?resultsLive=1` is in
  // the URL, so the form waits until that param is stripped.
  const isResultsLiveDialogActive = resultsLive === '1';

  const { data: form } = trpc.customForm.getForProfile.useQuery(
    {
      profileId: decisionProfileId ?? '',
      phaseId: currentPhaseId ?? undefined,
      initialPhaseId: instance?.instanceData?.phases?.[0]?.phaseId,
      showOn: 'entry',
    },
    {
      enabled:
        !!participantProfileId && !!decisionProfileId && !!currentPhaseId,
    },
  );

  if (
    !participantProfileId ||
    !form ||
    form.id === closedFormId ||
    isResultsLiveDialogActive ||
    hasSkipCookie(
      getFormSkipCookieName({ formId: form.id, participantProfileId }),
    )
  ) {
    return null;
  }

  return (
    <PhaseEntryCustomFormModal
      form={form}
      participantProfileId={participantProfileId}
      onClose={() => setClosedFormId(form.id)}
    />
  );
};

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
  const utils = trpc.useUtils();
  const submitForm = trpc.customForm.submit.useMutation({
    onSuccess: () => {
      onClose();
      void utils.customForm.getForProfile.invalidate({
        profileId: form.profileId,
      });
    },
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
    setSkipCookie(
      getFormSkipCookieName({ formId: form.id, participantProfileId }),
    );
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

const getFormSkipCookieName = ({
  formId,
  participantProfileId,
}: {
  formId: string;
  participantProfileId: string;
}) => `form-skipped-${formId}-${participantProfileId}`;
