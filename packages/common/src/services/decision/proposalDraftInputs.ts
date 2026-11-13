import { db } from '@op/db/client';
import { logger } from '@op/logging';

import { getCurrentProfileId } from '../access';
import { assertGlobalRole } from '../assert';
import { withBoundaryCategoryLabel } from './boundaryCategory';
import {
  type ProposalDataInput,
  parseProposalData,
} from './proposalDataSchema';
import type { PhaseInstanceData } from './schemas/instanceData';

/**
 * Resolves everything a new draft needs before its write transaction opens:
 * title, category labels and term ids, the author's profile, the owner role
 * and the phase's hidden default. The caller asserts access and the phase.
 */
export const resolveProposalDraftInputs = async ({
  authUserId,
  instanceProfileId,
  phase,
  proposalData,
}: {
  authUserId: string;
  instanceProfileId: string | null;
  phase: Pick<PhaseInstanceData, 'rules'>;
  proposalData: ProposalDataInput;
}) => {
  // Capture the phase's `defaults.hidden` rule at creation time. The flag
  // sticks with the proposal through submission, so a draft authored under
  // a hidden-by-default phase remains hidden even if the rule is edited
  // before submit.
  const defaultHidden = phase.rules?.proposals?.defaults?.hidden === true;

  const parsedProposalData = parseProposalData(proposalData);
  const proposalTitle = extractTitleFromProposalData(proposalData);

  // Include the location's council-district category (if any) so it is linked
  // through the normal category pipeline — no separate boundary-tagging pass.
  // Without a decision profile (legacy instances) the boundary lookup is
  // skipped and only the manual categories pass through.
  const manualCategoryLabels = [...new Set(parsedProposalData.category)];
  const categoryLabels = instanceProfileId
    ? await withBoundaryCategoryLabel(manualCategoryLabels, proposalData, {
        profileId: instanceProfileId,
      })
    : manualCategoryLabels;
  const categoryTermIds = await getCategoryTermIds(categoryLabels);

  const [submittedByProfileId, adminRole] = await Promise.all([
    getCurrentProfileId(authUserId),
    assertGlobalRole('Admin'),
  ]);

  return {
    proposalTitle,
    categoryLabels,
    categoryTermIds,
    submittedByProfileId,
    adminRoleId: adminRole.id,
    defaultHidden,
  };
};

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
