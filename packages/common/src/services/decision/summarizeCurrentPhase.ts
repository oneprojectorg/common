import {
  type PhaseInstanceData,
  getInstancePhases,
} from './schemas/instanceData';
import { getInstanceCurrentPhase } from './utils/instance';
import { isVotingPhase } from './utils/phaseSettings';

export interface CurrentPhaseSummary {
  currentPhase: PhaseInstanceData | null;
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
    currentPhase,
    votingOpen: currentPhase ? isVotingPhase(currentPhase) : false,
  };
};
