import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { type BudgetData, parseProposalData } from './proposalDataSchema';
import { buildProposalListPreview } from './proposalListPreview';
import type { ProposalTemplateSchema } from './types';

/**
 * The authoritative budget of each proposal, keyed by id.
 *
 * A collaborative proposal keeps its live budget in the Yjs `budget` fragment,
 * so `proposalData.budget` is a creation-time snapshot that goes stale the
 * moment an author edits it. Anything that charges a voter for a proposal has
 * to read the fragment, exactly as the proposal list does.
 *
 * A document that can't be fetched degrades to the snapshot rather than
 * failing the read (`onFetchError: 'omit'`), matching the proposal list.
 */
export async function resolveProposalBudgets(
  proposals: Array<{ id: string; proposalData: unknown }>,
  proposalTemplate: ProposalTemplateSchema | null,
): Promise<Map<string, BudgetData | null>> {
  const documentContentMap = await getProposalDocumentsContent(
    proposals.map(({ id, proposalData }) => ({
      id,
      proposalData,
      proposalTemplate,
    })),
  );

  return new Map(
    proposals.map(({ id, proposalData }) => {
      const parsed = parseProposalData(proposalData);
      const { systemFieldOverrides } = buildProposalListPreview({
        documentContent: documentContentMap.get(id),
        proposalTemplate,
        existingBudget: parsed.budget,
      });

      return [id, systemFieldOverrides.budget ?? parsed.budget ?? null];
    }),
  );
}
