import type { Proposal } from '@op/db/schema';

import { CommonError, ValidationError } from '../../utils';
import { getFieldUnit } from './fieldUnit';
import {
  ProposalCostUnavailableError,
  UnpriceableCostError,
  priceProposals,
} from './getProposalCosts';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import type { PhaseInstanceData } from './schemas/instanceData';
import { getVoterCostField } from './utils/phaseSettings';

/**
 * A proposal's price for the selection, or the error to raise if the
 * selection needs it. A proposal the pipeline drops before pricing it must
 * not block the advance.
 */
export type PhaseProposalCosts = ReadonlyMap<
  string,
  number | null | CommonError
>;

/** Priced from the live documents, as ballots are. */
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
}): Promise<PhaseProposalCosts> {
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

  const results = await priceProposals({
    proposals,
    proposalTemplate,
    voterCostField,
    unit,
    otherUnit: 'throw',
  });

  return new Map(
    [...results].map(([id, result]) => [id, toSelectionError(result)]),
  );
}

function toSelectionError(
  result: number | null | UnpriceableCostError | ProposalCostUnavailableError,
): number | null | CommonError {
  if (result instanceof UnpriceableCostError) {
    return new ValidationError(
      `The selection cannot price the ${result.field} of "${result.proposalTitle}". Correct the proposal, then advance the phase again.`,
    );
  }
  if (result instanceof ProposalCostUnavailableError) {
    return new CommonError(
      `The selection could not read the document of "${result.proposalTitle}" to price it. Advance the phase again; if this keeps failing, check that proposal's document.`,
    );
  }
  return result;
}
