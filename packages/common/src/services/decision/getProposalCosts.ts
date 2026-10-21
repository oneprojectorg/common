import type { AmountUnit } from '@op/types/amountUnit';

import { CommonError, ValidationError } from '../../utils';
import { getFieldAmount } from './fieldUnit';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { parseProposalData } from './proposalDataSchema';
import { resolveDocumentFieldValues } from './proposalListPreview';
import type { ProposalTemplateSchema } from './types';

export type ProposalCosts = ReadonlyMap<string, number | null>;

/** Reads the live document; `proposalData` is a snapshot that goes stale on edit. */
export async function getProposalCosts({
  proposals,
  proposalTemplate,
  voterCostField,
  unit,
}: {
  proposals: Array<{ id: string; proposalData: unknown }>;
  proposalTemplate: ProposalTemplateSchema | null;
  voterCostField: string;
  unit: AmountUnit;
}): Promise<ProposalCosts> {
  const documentContentMap = await getProposalDocumentsContent(
    proposals.map(({ id, proposalData }) => ({
      id,
      proposalData,
      proposalTemplate,
    })),
    { onFetchError: 'unavailable' },
  );

  return new Map(
    proposals.map(({ id, proposalData }) => {
      const documentContent = documentContentMap.get(id);

      // Charging the stale snapshot could let an over-budget ballot through.
      if (documentContent?.type === 'unavailable') {
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
        const title = parseProposalData(proposalData).title ?? id;

        throw new ValidationError(
          `The ${voterCostField} of "${title}" is not a valid amount, so this ballot cannot be priced. Remove it from your ballot, or ask an admin to correct the proposal.`,
        );
      }

      return [id, amount];
    }),
  );
}
