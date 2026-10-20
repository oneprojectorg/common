import { type AmountUnit, getFieldAmount } from './fieldUnit';
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
  );

  return new Map(
    proposals.map(({ id, proposalData }) => {
      const snapshot = getFieldAmount({
        value: parseProposalData(proposalData)[voterCostField],
        unit,
      });
      const documentContent = documentContentMap.get(id);

      if (documentContent?.type !== 'json') {
        return [id, snapshot];
      }

      const live = getFieldAmount({
        value: resolveDocumentFieldValues({
          fragments: documentContent.fragments,
          proposalTemplate,
          keys: [voterCostField],
        })[voterCostField],
        unit,
      });

      if (live === null) {
        return [id, snapshot];
      }

      // A fragment that fails to parse also yields 0, so 0 defers to the snapshot.
      return [id, live === 0 ? (snapshot ?? live) : live];
    }),
  );
}
