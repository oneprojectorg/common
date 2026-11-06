import { formatUnitAmount, getFieldUnit } from './fieldUnit';
import { getProposalCosts } from './getProposalCosts';
import type { InstanceWithPhases } from './instancePhases';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import { getInstanceCurrentPhase } from './utils/instance';
import { getVoterCostField } from './utils/phaseSettings';

export type BallotInstance = InstanceWithPhases<{
  id: string;
  instanceData: unknown;
  currentStateId: string | null;
  processId: string | null;
}>;

export async function priceBallotProposals({
  instance,
  proposals,
}: {
  instance: BallotInstance;
  proposals: ReadonlyArray<{ id: string; proposalData: unknown }>;
}): Promise<ReadonlyMap<string, string | null>> {
  const unpriced = new Map(proposals.map(({ id }) => [id, null]));
  const phase = getInstanceCurrentPhase(instance);

  if (!phase) {
    return unpriced;
  }

  const voterCostField = getVoterCostField(phase);
  const proposalTemplate = await resolveProposalTemplate(
    instance.instanceData,
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
    unreadable: 'null',
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
