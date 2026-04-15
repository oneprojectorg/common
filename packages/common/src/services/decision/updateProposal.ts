import { getTipTapClient } from '@op/collab';
import { type TransactionType, and, db, eq } from '@op/db/client';
import {
  ProposalStatus,
  type Visibility,
  profiles,
  proposalCategories,
  proposals,
  taxonomies,
  taxonomyTerms,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
import { assertInstanceProfileAccess, getProfileAccessUser } from '../access';
import { assertUserByAuthId } from '../assert';
import type {
  CheckpointVersion,
  ProposalDataInput,
} from './proposalDataSchema';
import { parseProposalData } from './proposalDataSchema';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import { type DecisionInstanceData, isLastPhase } from './schemas/instanceData';
import { validateProposalAgainstTemplate } from './validateProposalAgainstTemplate';

async function updateProposalCategoryLink(
  tx: TransactionType,
  proposalId: string,
  newCategoryLabels: string[],
): Promise<void> {
  await tx
    .delete(proposalCategories)
    .where(eq(proposalCategories.proposalId, proposalId));

  if (newCategoryLabels.length === 0) {
    return;
  }

  const proposalTaxonomy = await tx._query.taxonomies.findFirst({
    where: eq(taxonomies.name, 'proposal'),
  });

  if (!proposalTaxonomy) {
    console.warn('No "proposal" taxonomy found, skipping category linking');
    return;
  }

  const taxonomyTermIds: string[] = [];

  for (const categoryLabel of newCategoryLabels) {
    if (!categoryLabel.trim()) {
      continue;
    }

    const taxonomyTerm = await tx._query.taxonomyTerms.findFirst({
      where: and(
        eq(taxonomyTerms.label, categoryLabel.trim()),
        eq(taxonomyTerms.taxonomyId, proposalTaxonomy.id),
      ),
    });

    if (!taxonomyTerm) {
      console.warn(`No taxonomy term found for category: ${categoryLabel}`);
      continue;
    }

    taxonomyTermIds.push(taxonomyTerm.id);
  }

  if (taxonomyTermIds.length > 0) {
    await tx.insert(proposalCategories).values(
      taxonomyTermIds.map((taxonomyTermId) => ({
        proposalId,
        taxonomyTermId,
      })),
    );
  }
}

export interface UpdateProposalInput {
  title?: string;
  proposalData?: ProposalDataInput;
  status?: ProposalStatus;
  visibility?: Visibility;
  checkpointVersion?: CheckpointVersion;
}

export const updateProposal = async ({
  proposalId,
  data,
  user,
}: {
  proposalId: string;
  data: UpdateProposalInput;
  user: User;
}) => {
  const dbUser = await assertUserByAuthId(user.id);

  if (!dbUser.profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  // Check if proposal exists and user has permission to update it
  const existingProposal = await db.query.proposals.findFirst({
    where: { id: proposalId },
    with: {
      processInstance: true,
      profile: true,
    },
  });

  if (!existingProposal) {
    throw new NotFoundError('Proposal');
  }

  const processInstance = existingProposal.processInstance;

  // Reject updates when the instance is in the final (results) phase
  const instancePhases =
    (processInstance.instanceData as DecisionInstanceData | null)?.phases ?? [];
  if (isLastPhase(processInstance.currentStateId, instancePhases)) {
    throw new ValidationError(
      'Proposals cannot be edited during the results phase',
    );
  }

  // Status and visibility changes only require instance-level decisions: ADMIN
  if (data.status || data.visibility) {
    await assertInstanceProfileAccess({
      user: { id: user.id },
      instance: processInstance,
      profilePermissions: { decisions: permission.ADMIN },
      orgFallbackPermissions: [{ decisions: permission.ADMIN }],
    });
  } else {
    // Data updates require profile-level update permission on the proposal's profile
    const proposalProfileUser = await getProfileAccessUser({
      user: { id: user.id },
      profileId: existingProposal.profileId,
    });

    const hasProposalUpdate = checkPermission(
      { profile: permission.UPDATE },
      proposalProfileUser?.roles ?? [],
    );

    if (!hasProposalUpdate) {
      await assertInstanceProfileAccess({
        user: { id: user.id },
        instance: processInstance,
        profilePermissions: { decisions: permission.UPDATE },
        orgFallbackPermissions: [{ decisions: permission.ADMIN }],
      });
    }
  }

  // Validate proposal data against template schema when updating non-draft proposals.
  // Drafts are inherently incomplete — validation is enforced on submission.
  if (data.proposalData && existingProposal.status !== ProposalStatus.DRAFT) {
    const instanceData =
      processInstance.instanceData as DecisionInstanceData | null;

    const proposalTemplate = await resolveProposalTemplate(
      instanceData,
      processInstance.processId,
    );

    if (proposalTemplate) {
      await validateProposalAgainstTemplate(
        proposalTemplate,
        data.proposalData,
        data.title ?? existingProposal.profile.name,
      );
    }
  }

  const collaborationDocVersionId =
    data.checkpointVersion && existingProposal.status !== ProposalStatus.DRAFT
      ? await createCheckpointVersion(existingProposal.proposalData)
      : null;

  const {
    title: nextTitle,
    checkpointVersion: _checkpointVersion,
    ...proposalFields
  } = data;

  const updatedProposal = await db.transaction(async (tx) => {
    const proposalDataWithVersion =
      collaborationDocVersionId !== null
        ? {
            ...(proposalFields.proposalData ??
              (existingProposal.proposalData as Record<string, unknown>)),
            collaborationDocVersionId,
          }
        : proposalFields.proposalData;

    const [updatedProposalRow] = await tx
      .update(proposals)
      .set({
        ...proposalFields,
        ...(proposalDataWithVersion
          ? { proposalData: proposalDataWithVersion }
          : {}),
        lastEditedByProfileId: dbUser.profileId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(proposals.id, proposalId))
      .returning();

    if (!updatedProposalRow) {
      throw new CommonError('Failed to update proposal');
    }

    if (nextTitle !== undefined) {
      await tx
        .update(profiles)
        .set({
          name: nextTitle,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(profiles.id, existingProposal.profileId));
    }

    // Update category link if proposal data was updated
    if (data.proposalData) {
      const newCategoryLabels = parseProposalData(data.proposalData).category;
      await updateProposalCategoryLink(tx, proposalId, newCategoryLabels);
    }

    const proposal = await tx.query.proposals.findFirst({
      where: { id: updatedProposalRow.id },
      with: { profile: true },
    });

    if (!proposal) {
      throw new CommonError('Failed to update proposal');
    }

    return proposal;
  });

  return updatedProposal;
};

async function createCheckpointVersion(
  proposalData: unknown,
): Promise<number | null> {
  const parsed = parseProposalData(proposalData);

  if (!parsed.collaborationDocId) {
    throw new ValidationError('Proposal is missing a collaboration document');
  }

  const latestVersion = await getTipTapClient()
    .createVersion(parsed.collaborationDocId, { name: 'Updated' })
    .then((v) => v?.version ?? null)
    .catch((error: unknown) => {
      console.error(
        `[updateProposal] Failed to create TipTap version for ${parsed.collaborationDocId}:`,
        error,
      );
      return null;
    });

  if (
    latestVersion != null &&
    latestVersion !== parsed.collaborationDocVersionId
  ) {
    return latestVersion;
  }

  return null;
}
