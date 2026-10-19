import { getInstancePhases } from './schemas/instanceData';
import { getInstanceCurrentPhase } from './utils/instance';
import { isVotingPhase } from './utils/phaseSettings';

export interface CurrentPhaseSummary {
  phaseName: string | null;
  votingOpen: boolean;
}

export const summarizeCurrentPhase = ({
  instanceData,
  currentStateId,
}: {
  instanceData: unknown;
  currentStateId: string | null;
}): CurrentPhaseSummary => {
  const currentPhase = getInstanceCurrentPhase({
    currentStateId,
    instanceData: { phases: getInstancePhases(instanceData) },
  });
  return {
    phaseName: currentPhase?.name ?? null,
    votingOpen: currentPhase ? isVotingPhase(currentPhase) : false,
  };
};
