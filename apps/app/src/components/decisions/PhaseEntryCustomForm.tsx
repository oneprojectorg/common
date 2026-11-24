'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import dynamic from 'next/dynamic';
import { useQueryState } from 'nuqs';
import { useState } from 'react';

import { QUERY_PARAM as RESULTS_LIVE_QUERY_PARAM } from './FinalPhaseSubmissionSuccessDialog';
import { getFormSkipCookieName, hasSkipCookie } from './skipCookie';

// Loaded only when a participant owes an entry form: this mounts on every
// decision page, and the form modal brings the AJV validator with it.
const PhaseEntryCustomFormModal = dynamic(
  () =>
    import('./PhaseEntryCustomFormModal').then(
      (module) => module.PhaseEntryCustomFormModal,
    ),
  { ssr: false },
);

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
      trigger: 'entry',
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
