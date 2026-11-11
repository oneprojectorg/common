import type { Proposal } from '@op/db/schema';

import { BallotCostError, ValidationError } from '../../utils';
import { getFieldUnit } from './fieldUnit';
import { type ProposalCosts, getProposalCosts } from './getProposalCosts';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import type { PhaseInstanceData } from './schemas/instanceData';
import { getVoterCostField } from './utils/phaseSettings';

/**
 * Prices a phase's proposals for its budget block the way its ballots are
 * priced: from the live documents, in the voter cost field's unit.
 */
export async function getPhaseProposalCosts({
  instanceData,
  processId,
  phase,
  proposals,
}: {
  instanceData: unknown;
  processId: string | null;
  phase: PhaseInstanceData;
  proposals: Proposal[];
}): Promise<ProposalCosts> {
  const voterCostField = getVoterCostField(phase);
  const proposalTemplate = await resolveProposalTemplate(
    instanceData,
    processId,
  );
  const unit = getFieldUnit(proposalTemplate?.properties?.[voterCostField]);

  if (!unit) {
    throw new ValidationError(
      `Selection is misconfigured: "${voterCostField}" is not a priced field on the proposal template.`,
    );
  }

  try {
    return await getProposalCosts({
      proposals,
      proposalTemplate,
      voterCostField,
      unit,
    });
  } catch (error) {
    if (error instanceof BallotCostError) {
      throw new ValidationError(
        `The selection cannot price every proposal. ${error.message} Correct the proposal, then advance the phase again.`,
      );
    }
    throw error;
  }
}
