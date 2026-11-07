import { formatUnitAmount, getFieldUnit } from './fieldUnit';
import { getProposalCosts } from './getProposalCosts';
import {
  resolveProposalTemplate,
  resolveProposalTemplatesByFormSchemaId,
} from './resolveProposalTemplate';
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
  proposals: ReadonlyArray<{
    id: string;
    proposalData: unknown;
    formSchemaId: string | null;
  }>;
}): Promise<ReadonlyMap<string, string | null>> {
  const unpriced = new Map(proposals.map(({ id }) => [id, null]));
  const phase = findCurrentPhase(instance);

  if (!phase) {
    return unpriced;
  }

  const voterCostField = getVoterCostField(phase);
  // The phase has no form schema pointer yet, so the charging unit is the
  // instance template's; each proposal's cost is read through its own template.
  const proposalTemplate = await resolveProposalTemplate({
    instanceData: instance.instanceData,
    processId: instance.processId,
  });
  const unit = getFieldUnit(proposalTemplate?.properties?.[voterCostField]);

  if (!unit) {
    return unpriced;
  }

  const templateFor = await resolveProposalTemplatesByFormSchemaId({
    formSchemaIds: proposals.map(({ formSchemaId }) => formSchemaId),
    instanceData: instance.instanceData,
    processId: instance.processId,
  });

  const costs = await getProposalCosts({
    proposals: proposals.map(({ id, proposalData, formSchemaId }) => ({
      id,
      proposalData,
      proposalTemplate: templateFor(formSchemaId),
    })),
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
