import { ValidationError } from '../../utils';
import { getFieldUnit } from './fieldUnit';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import type { DecisionInstanceData } from './schemas/instanceData';
import { getVoterCostField, getVoterBudget } from './utils/phaseSettings';

// Every phase with a voter budget must charge from a template field that has a unit.
export async function assertVoterCostField({
  instanceData,
  processId,
}: {
  instanceData: DecisionInstanceData;
  processId: string | null;
}): Promise<void> {
  const capped = instanceData.phases.filter(
    (phase) => getVoterBudget(phase) !== undefined,
  );

  if (capped.length === 0) {
    return;
  }

  const template = await resolveProposalTemplate(instanceData, processId);

  for (const phase of capped) {
    const voterCostField = getVoterCostField(phase);

    if (!getFieldUnit(template?.properties?.[voterCostField])) {
      throw new ValidationError(
        `A voter budget charges from "${voterCostField}", which is not a money field or a numeric field with a unit on the proposal template.`,
        { voterCostField: 'Must name a priced field on the proposal template' },
      );
    }
  }
}
