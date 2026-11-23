'use client';

import type { ProcessInstance } from '@op/api/encoders';

import { PhaseEntryCustomForm } from './PhaseEntryCustomForm';

interface PhaseEntryCustomFormGateProps {
  instance: ProcessInstance;
}

export const PhaseEntryCustomFormGate = ({
  instance,
}: PhaseEntryCustomFormGateProps) => {
  const initialPhaseId = instance.instanceData?.phases?.[0]?.phaseId;

  return (
    <PhaseEntryCustomForm
      profileId={instance.profileId}
      currentPhaseId={instance.currentStateId ?? undefined}
      initialPhaseId={initialPhaseId}
    />
  );
};
