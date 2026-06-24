import { getTipTapClient } from '@op/collab';
import { db, eq } from '@op/db/client';
import {
  ProposalStatus,
  type Visibility,
  profiles,
  proposals,
} from '@op/db/schema';
import { Events, outboxSend } from '@op/events';
import type { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils';
import { assertInstanceProfileAccess, getProfileAccessRoles } from '../access';
import { assertUserByAuthId } from '../assert';
import { withBoundaryCategoryLabel } from './boundaryCategory';
import type {
  CheckpointVersion,
  ProposalDataInput,
} from './proposalDataSchema';
import { parseProposalData } from './proposalDataSchema';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import { type DecisionInstanceData, isLastPhase } from './schemas/instanceData';
import { setProposalCategories } from './setProposalCategories';
import { syncProposalProfileLocation } from './syncProposalProfileLocation';
import { validateProposalAgainstTemplate } from './validateProposalAgainstTemplate';

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
    throw new NotFoundError('Proposal', proposalId);
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
    const proposalRoles = await getProfileAccessRoles({
      user: { id: user.id },
      profileId: existingProposal.profileId,
    });

    const hasProposalUpdate = checkPermission(
      { profile: permission.UPDATE },
      proposalRoles,
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
      if (!processInstance.profileId) {
        throw new NotFoundError('Decision profile');
      }
      await validateProposalAgainstTemplate(
        proposalTemplate,
        data.proposalData,
        data.title ?? existingProposal.profile.name,
        { profileId: processInstance.profileId },
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
    // Resolve the full category set (manual selections plus the location's
    // council district) once, so it persists to BOTH proposalData.category (the
    // read/display source) and the proposalCategories junction (the filter
    // source) — keeping them in sync, as createProposal already does. Without a
    // decision profile we can't scope the boundary lookup, so the manual
    // category set passes through untouched.
    const categoryLabels =
      data.proposalData && processInstance.profileId
        ? await withBoundaryCategoryLabel(
            parseProposalData(data.proposalData).category,
            data.proposalData,
            { profileId: processInstance.profileId },
          )
        : data.proposalData
          ? parseProposalData(data.proposalData).category
          : null;

    const baseProposalData =
      collaborationDocVersionId !== null
        ? {
            ...(proposalFields.proposalData ??
              (existingProposal.proposalData as Record<string, unknown>)),
            collaborationDocVersionId,
          }
        : proposalFields.proposalData;

    const proposalDataWithVersion =
      baseProposalData && categoryLabels
        ? {
            ...baseProposalData,
            category: categoryLabels.length > 0 ? categoryLabels : undefined,
          }
        : baseProposalData;

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

    // Keep the profile's location relation in sync whenever proposalData is
    // written; status/visibility-only updates leave it untouched.
    if (proposalDataWithVersion) {
      await syncProposalProfileLocation(
        tx,
        existingProposal.profileId,
        proposalDataWithVersion,
      );
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

    // Mirror the resolved category set (manual + district) into the junction.
    if (categoryLabels) {
      await setProposalCategories({ tx, proposalId, labels: categoryLabels });
    }

    const proposal = await tx.query.proposals.findFirst({
      where: { id: updatedProposalRow.id },
      with: { profile: true },
    });

    if (!proposal) {
      throw new CommonError('Failed to update proposal');
    }

    // Re-moderate edits to already-public proposals via the durable outbox.
    // Drafts are first moderated on submit (see submitProposal), so editing
    // a draft doesn't enqueue review of not-yet-public content.
    if (proposal.status !== ProposalStatus.DRAFT) {
      await outboxSend(tx, {
        name: Events.contentSubmitted.name,
        data: {
          itemType: 'proposal',
          itemId: proposal.id,
        },
      });
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
