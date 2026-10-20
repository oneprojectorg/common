import { CommonError } from '../../utils';
import { type AmountUnit, getFieldAmount } from './fieldUnit';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { parseProposalData } from './proposalDataSchema';
import { getDocumentFieldTexts } from './proposalListPreview';
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
          ? parseFieldText(
              getDocumentFieldTexts({
                fragments: documentContent.fragments,
                keys: [voterCostField],
              })[voterCostField],
            )
          : parseProposalData(proposalData)[voterCostField];

      return [id, getFieldAmount({ value, unit })];
    }),
  );
}

function parseFieldText(text: string | undefined): unknown {
  if (text === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
