'use client';

import { trpc } from '@op/api/client';
import type { ProcessInstance } from '@op/api/encoders';
import { Suspense } from 'react';

import { PhaseEntryCustomForm } from './PhaseEntryCustomForm';

interface PhaseEntryCustomFormGateProps {
  instanceId: string;
  instance?: ProcessInstance;
}

export const PhaseEntryCustomFormGate = ({
  instanceId,
  instance,
}: PhaseEntryCustomFormGateProps) => {
  if (instance) {
    return (
      <PhaseEntryCustomFormGateInner
        profileId={instance.profileId}
        currentStateId={instance.currentStateId}
        instanceData={instance.instanceData}
      />
    );
  }

  return (
    <Suspense fallback={null}>
      <PhaseEntryCustomFormGateFetch instanceId={instanceId} />
    </Suspense>
  );
};

function PhaseEntryCustomFormGateFetch({ instanceId }: { instanceId: string }) {
  const { data: instance } = trpc.decision.getInstance.useQuery({ instanceId });

  if (!instance) {
    return null;
  }

  return (
    <PhaseEntryCustomFormGateInner
      profileId={instance.profileId}
      currentStateId={instance.currentStateId}
      instanceData={instance.instanceData}
    />
  );
}

function PhaseEntryCustomFormGateInner({
  profileId,
  currentStateId,
  instanceData,
}: {
  profileId: string;
  currentStateId: string | null;
  instanceData?: {
    phases?: readonly {
      phaseId?: string;
    }[];
  } | null;
}) {
  const initialPhaseId = instanceData?.phases?.[0]?.phaseId;

  return (
    <PhaseEntryCustomForm
      profileId={profileId}
      currentPhaseId={currentStateId ?? undefined}
      initialPhaseId={initialPhaseId}
    />
  );
}
