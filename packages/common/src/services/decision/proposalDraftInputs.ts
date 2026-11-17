import { db } from '@op/db/client';
import { logger } from '@op/logging';

import { NotFoundError } from '../../utils';
import { getCurrentProfileId } from '../access';
import { assertGlobalRole } from '../assert';
import { withBoundaryCategoryLabel } from './boundaryCategory';
import {
  type ProposalDataInput,
  parseProposalData,
} from './proposalDataSchema';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import type { PhaseInstanceData } from './schemas/instanceData';

/**
 * Resolves everything a new draft needs before its write transaction opens:
 * title, category labels and term ids, the author's profile, the owner role,
 * and the phase's hidden default and form. The caller asserts access and the
 * phase.
 */
export const resolveProposalDraftInputs = async ({
  authUserId,
  processInstanceId,
  instanceProfileId,
  phase,
  proposalData,
}: {
  authUserId: string;
  processInstanceId: string;
  instanceProfileId: string | null;
  phase: Pick<PhaseInstanceData, 'rules' | 'formSchemaId'>;
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

  const [submittedByProfileId, adminRole, formSchemaId] = await Promise.all([
    getCurrentProfileId(authUserId),
    assertGlobalRole('Admin'),
    getPhaseFormSchemaId({
      formSchemaId: phase.formSchemaId,
      processInstanceId,
    }),
  ]);

  return {
    proposalTitle,
    categoryLabels,
    categoryTermIds,
    submittedByProfileId,
    adminRoleId: adminRole.id,
    defaultHidden,
    formSchemaId,
  };
};

/**
 * The form a draft is written under: the phase's, or null for the instance
 * template. Refused like every other read of a missing or malformed row.
 */
const getPhaseFormSchemaId = async ({
  formSchemaId,
  processInstanceId,
}: {
  formSchemaId: string | null | undefined;
  processInstanceId: string;
}): Promise<string | null> => {
  if (!formSchemaId) {
    return null;
  }

  await resolveProposalTemplate(null, null, formSchemaId);
  // The resolver reads the row by id alone.
  const row = await db.query.formSchemas.findFirst({
    where: { id: formSchemaId, processInstanceId },
    columns: { id: true },
  });
  if (!row) {
    throw new NotFoundError('Form schema', formSchemaId);
  }

  return row.id;
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
