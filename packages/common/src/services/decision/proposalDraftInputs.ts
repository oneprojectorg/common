import { db } from '@op/db/client';
import { logger } from '@op/logging';

import type { ProposalDataInput } from './proposalDataSchema';

/**
 * Resolve category labels to proposal taxonomy term ids. Unknown labels are
 * logged and dropped; a failed lookup links no categories.
 */
export const getCategoryTermIds = async (
  categoryLabels: string[],
): Promise<string[]> => {
  if (categoryLabels.length === 0) {
    return [];
  }

  try {
    const proposalTaxonomy = await db.query.taxonomies.findFirst({
      where: { name: 'proposal' },
      with: { taxonomyTerms: true },
    });

    const labelSet = new Set(categoryLabels);
    const matchedTerms: { id: string; label: string }[] = (
      proposalTaxonomy?.taxonomyTerms ?? []
    ).filter((term: { label: string }) => labelSet.has(term.label));
    const matchedLabels = new Set(matchedTerms.map((term) => term.label));

    for (const categoryLabel of categoryLabels) {
      if (!matchedLabels.has(categoryLabel)) {
        logger.warn('No valid proposal taxonomy term found for category', {
          categoryLabel,
        });
      }
    }

    return matchedTerms.map((term) => term.id);
  } catch (error) {
    logger.error(
      'Error fetching category terms, proceeding without category links',
      { error },
    );
    return [];
  }
};

export const extractTitleFromProposalData = (
  proposalData: ProposalDataInput,
): string => {
  if (proposalData.title) {
    return proposalData.title;
  }
  if (typeof proposalData.name === 'string' && proposalData.name) {
    return proposalData.name;
  }
  return 'Untitled Proposal';
};
