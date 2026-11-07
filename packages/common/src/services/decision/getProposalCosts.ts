import type { AmountUnit } from '@op/types/amountUnit';

import { BallotCostError, CommonError } from '../../utils';
import { getFieldAmount } from './fieldUnit';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { parseProposalData } from './proposalDataSchema';
import { resolveDocumentFieldValues } from './proposalListPreview';
import type { ProposalTemplateSchema } from './types';

export type ProposalCosts = ReadonlyMap<string, number | null>;

/**
 * Reads the live document; `proposalData` is a snapshot that goes stale on edit.
 * Each proposal carries its own template, so one ballot can mix form schemas.
 */
export async function getProposalCosts({
  proposals,
  voterCostField,
  unit,
  unreadable = 'throw',
}: {
  proposals: Array<{
    id: string;
    proposalData: unknown;
    proposalTemplate: ProposalTemplateSchema | null;
  }>;
  voterCostField: string;
  unit: AmountUnit;
  unreadable?: 'throw' | 'null';
}): Promise<ProposalCosts> {
  const documentContentMap = await getProposalDocumentsContent(
    proposals.map(({ id, proposalData, proposalTemplate }) => ({
      id,
      proposalData,
      proposalTemplate,
    })),
    { onFetchError: 'unavailable' },
  );

  return new Map(
    proposals.map(({ id, proposalData, proposalTemplate }) => {
      const documentContent = documentContentMap.get(id);

      // Charging the stale snapshot could let an over-budget ballot through.
      if (documentContent?.type === 'unavailable') {
        if (unreadable === 'null') {
          return [id, null];
        }
        throw new CommonError(
          'Could not read the current cost of a selected proposal. Please try again.',
        );
      }

      const value =
        documentContent?.type === 'json'
          ? resolveDocumentFieldValues({
              fragments: documentContent.fragments,
              proposalTemplate,
              keys: [voterCostField],
            })[voterCostField]
          : parseProposalData(proposalData)[voterCostField];
      const amount = getFieldAmount({ value, unit });

      // A cost that is filled in but unreadable must not ride free on a capped ballot.
      if (amount === null && typeof value === 'string' && value.trim()) {
        if (unreadable === 'null') {
          return [id, null];
        }
        const title = parseProposalData(proposalData).title ?? id;

        throw new BallotCostError(
          `The ${voterCostField} of "${title}" is not a valid amount, so this ballot cannot be priced. Remove it from your ballot, or ask an admin to correct the proposal.`,
        );
      }

      return [id, amount];
    }),
  );
}
