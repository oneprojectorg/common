import { formatSmsAmount } from '../sms/formatSmsAmount';
import { getFieldUnit } from './fieldUnit';
import { getProposalCosts } from './getProposalCosts';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import { getInstancePhases } from './schemas/instanceData';
import { getInstanceCurrentPhase } from './utils/instance';
import { getVoterCostField } from './utils/phaseSettings';

export interface BallotInstance {
  id: string;
  instanceData: unknown;
  currentStateId: string | null;
  processId: string | null;
}

const findCurrentPhase = ({ instanceData, currentStateId }: BallotInstance) =>
  getInstanceCurrentPhase({
    currentStateId,
    instanceData: { phases: getInstancePhases(instanceData) },
  });

export async function priceBallotProposals({
  instance,
  proposals,
}: {
  instance: BallotInstance;
  proposals: ReadonlyArray<{ id: string; proposalData: unknown }>;
}): Promise<ReadonlyMap<string, string | null>> {
  const unpriced = new Map(proposals.map(({ id }) => [id, null]));
  const phase = findCurrentPhase(instance);

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
  });

  return new Map(
    proposals.map(({ id }) => {
      const amount = costs.get(id);
      return [
        id,
        amount === null || amount === undefined
          ? null
          : formatSmsAmount({ amount, unit }),
      ];
    }),
  );
}
