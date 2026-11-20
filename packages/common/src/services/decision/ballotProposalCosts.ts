import { formatUnitAmount } from './fieldUnit';
import { getProposalCostsByForm } from './getProposalCostsByForm';
import type { InstanceWithPhases } from './instancePhases';
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
  proposals: ReadonlyArray<{
    id: string;
    proposalData: unknown;
    formSchemaId: string | null;
  }>;
}): Promise<ReadonlyMap<string, string | null>> {
  const unpriced = new Map(proposals.map(({ id }) => [id, null]));
  const phase = getInstanceCurrentPhase(instance);

  if (!phase) {
    return unpriced;
  }

  const costs = await getProposalCostsByForm({
    instanceData: instance.instanceData,
    processId: instance.processId,
    proposals,
    voterCostField: getVoterCostField(phase),
    unreadable: 'null',
  });

  return new Map(
    proposals.map(({ id }) => {
      const cost = costs.get(id);
      return [
        id,
        cost?.amount == null || !cost.unit
          ? null
          : formatUnitAmount({ amount: cost.amount, unit: cost.unit }),
      ];
    }),
  );
}
