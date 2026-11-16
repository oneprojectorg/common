import type { PhaseInstanceData } from './schemas/instanceData';
import { getInstanceCurrentPhase } from './utils/instance';
import { isVotingPhase } from './utils/phaseSettings';

export interface CurrentPhaseSummary {
  phaseName: string | null;
  votingOpen: boolean;
}

export const summarizeCurrentPhase = ({
  phases,
  currentStateId,
}: {
  phases: readonly PhaseInstanceData[];
  currentStateId: string | null;
}): CurrentPhaseSummary => {
  const currentPhase = getInstanceCurrentPhase({ currentStateId, phases });
  return {
    phaseName: currentPhase?.name ?? null,
    votingOpen: currentPhase ? isVotingPhase(currentPhase) : false,
  };
};
