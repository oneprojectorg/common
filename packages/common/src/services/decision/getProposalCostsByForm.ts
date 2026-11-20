import type { AmountUnit } from '@op/types/amountUnit';

import { BallotCostError } from '../../utils';
import { getFieldUnit, isSameUnit } from './fieldUnit';
import { type ProposalCosts, getProposalCosts } from './getProposalCosts';
import { parseProposalData } from './proposalDataSchema';
import { resolveProposalTemplate } from './resolveProposalTemplate';

export interface ProposalCost {
  amount: number | null;
  /** Undefined when the proposal's form does not price the cost field. */
  unit: AmountUnit | undefined;
}

/**
 * Reads each proposal's cost under its own form, in the unit that form gives
 * the cost field. Resolves one template per distinct `formSchemaId`.
 */
export async function getProposalCostsByForm({
  instanceData,
  processId,
  proposals,
  voterCostField,
  unreadable,
}: {
  instanceData: unknown;
  processId: string | null;
  proposals: ReadonlyArray<{
    id: string;
    proposalData: unknown;
    formSchemaId: string | null;
  }>;
  voterCostField: string;
  unreadable: 'throw' | 'null';
}): Promise<ReadonlyMap<string, ProposalCost>> {
  const byForm = new Map<string | null, Array<(typeof proposals)[number]>>();
  for (const proposal of proposals) {
    const group = byForm.get(proposal.formSchemaId) ?? [];
    group.push(proposal);
    byForm.set(proposal.formSchemaId, group);
  }

  const costs = await Promise.all(
    [...byForm].map(async ([formSchemaId, group]) => {
      const proposalTemplate = await resolveProposalTemplate(
        instanceData,
        processId,
        formSchemaId,
      );
      const unit = getFieldUnit(proposalTemplate?.properties?.[voterCostField]);

      if (!unit) {
        return group.map(({ id }): [string, ProposalCost] => [
          id,
          { amount: null, unit },
        ]);
      }

      const amounts = await getProposalCosts({
        proposals: group,
        proposalTemplate,
        voterCostField,
        unit,
        unreadable,
      });

      return group.map(({ id }): [string, ProposalCost] => [
        id,
        { amount: amounts.get(id) ?? null, unit },
      ]);
    }),
  );

  return new Map(costs.flat());
}

/**
 * The amounts of `costs` in `unit`, the unit a cap is compared in. A proposal
 * whose form prices the cost field in another unit, or not at all, is null or
 * throws `BallotCostError`, so it never counts as free.
 */
export function getAmountsInUnit({
  proposals,
  costs,
  unit,
  voterCostField,
  unreadable,
}: {
  proposals: ReadonlyArray<{ id: string; proposalData: unknown }>;
  costs: ReadonlyMap<string, ProposalCost>;
  unit: AmountUnit;
  voterCostField: string;
  unreadable: 'throw' | 'null';
}): ProposalCosts {
  return new Map(
    proposals.map(({ id, proposalData }) => {
      const cost = costs.get(id);

      if (cost?.unit && isSameUnit(cost.unit, unit)) {
        return [id, cost.amount];
      }

      if (unreadable === 'null') {
        return [id, null];
      }

      const title = parseProposalData(proposalData).title ?? id;

      throw new BallotCostError(
        `The ${voterCostField} of "${title}" is not priced in the unit of the voter budget, so this ballot cannot be priced. Remove it from your ballot, or ask an admin to correct the proposal.`,
      );
    }),
  );
}
