import { formatUnitAmount, getFieldUnit } from './fieldUnit';
import { getProposalCosts } from './getProposalCosts';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import type { DecisionInstanceData } from './schemas/instanceData';
import { getVoterBudget, getVoterCostField } from './utils/phaseSettings';

export interface BallotInstance {
  id: string;
  instanceData: unknown;
  currentStateId: string | null;
  processId: string | null;
}

const findCurrentPhase = ({ instanceData, currentStateId }: BallotInstance) =>
  (instanceData as DecisionInstanceData).phases?.find(
    (phase) => phase.phaseId === currentStateId,
  );

export async function priceBallotProposals({
  instance,
  proposals,
}: {
  instance: BallotInstance;
  proposals: ReadonlyArray<{ id: string; proposalData: unknown }>;
}): Promise<ReadonlyMap<string, string | null>> {
  const unpriced = new Map(proposals.map(({ id }) => [id, null]));
  const phase = findCurrentPhase(instance);

  if (!phase || getVoterBudget(phase) === undefined) {
    return unpriced;
  }

  const voterCostField = getVoterCostField(phase);
  const proposalTemplate = await resolveProposalTemplate(
    instance.instanceData as Record<string, unknown> | null,
    instance.processId,
  );
  const unit = getFieldUnit(proposalTemplate?.properties?.[voterCostField]);

  if (!unit) {
    return unpriced;
  }

  const costs = await getProposalCosts({
    proposals: [...proposals],
    proposalTemplate,
    voterCostField,
    unit,
  });

  return new Map(
    proposals.map(({ id }) => {
      const amount = costs.get(id);
      return [
        id,
        amount === null || amount === undefined
          ? null
          : formatUnitAmount({ amount, unit }),
      ];
    }),
  );
}
