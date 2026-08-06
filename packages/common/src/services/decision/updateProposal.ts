import { getTipTapClient, invalidateCachedDocumentFragments } from '@op/collab';
import { and, db, eq, isNull } from '@op/db/client';
import {
  ProposalStatus,
  type Visibility,
  profiles,
  proposals,
} from '@op/db/schema';
import { logger } from '@op/logging';
import type { User } from '@op/supabase/lib';
import { waitUntil } from '@vercel/functions';
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
import { getProposalFragmentNames } from './getProposalFragmentNames';
import type {
  CheckpointVersion,
  ProposalDataInput,
} from './proposalDataSchema';
import { parseProposalData } from './proposalDataSchema';
import { reconcileReviewAssignments } from './reconcileReviewAssignments';
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

  // Check if proposal exists and user has permission to update it.
  // Moderation-detached (CSAM) rows return 404 identically to a missing row —
  // even the original author cannot edit their way back to a takedown.
  const existingProposal = await db.query.proposals.findFirst({
    where: {
      RAW: (table) =>
        and(eq(table.id, proposalId), isNull(table.moderationDetachedAt))!,
    },
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

    // `proposalData` replaces the stored JSON column wholesale, so both
    // collaboration doc pointers are resolved server-side and re-applied over
    // the caller's payload rather than read out of it.
    //
    // The version pointer: a partial or stale payload must not be able to unpin
    // a submitted proposal by dropping it (see `submitProposal` for why an
    // unpinned proposal is a defect). A freshly minted checkpoint version
    // supersedes the stored one.
    //
    // The document id: it addresses a collaboration document, so accepting it
    // from the caller would let anyone with update access on their own proposal
    // point it at another proposal's document and render that content as their
    // own. A stored id is kept as-is; otherwise the caller only gets to decide
    // *whether* this proposal has a document (legacy HTML-only proposals have
    // none and must stay that way), never which one — the id itself is derived
    // exactly as `createProposal` derives it.
    const storedProposalData = parseProposalData(existingProposal.proposalData);
    const pinnedVersionId =
      collaborationDocVersionId ?? storedProposalData.collaborationDocVersionId;

    const incomingProposalData =
      proposalFields.proposalData ??
      (collaborationDocVersionId !== null
        ? (existingProposal.proposalData as Record<string, unknown>)
        : undefined);

    const collaborationDocId =
      storedProposalData.collaborationDocId ??
      (incomingProposalData &&
      parseProposalData(incomingProposalData).collaborationDocId
        ? `proposal-${proposalId}`
        : undefined);

    const baseProposalData = incomingProposalData
      ? {
          ...incomingProposalData,
          ...(collaborationDocId ? { collaborationDocId } : {}),
          ...(pinnedVersionId !== undefined
            ? { collaborationDocVersionId: pinnedVersionId }
            : {}),
        }
      : undefined;

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
      // Reconcile this proposal's by-category assignments in the same tx so a
      // category change can't commit and leave stale assignments behind:
      // add reviewers for new categories, prune pending for dropped ones.
      await reconcileReviewAssignments({
        db: tx,
        instanceId: processInstance.id,
        affected: { proposalIds: [proposalId] },
      });
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

  // When a checkpoint mints a new TipTap version, evict the prior version's
  // cached fragments. Best-effort and non-blocking.
  if (collaborationDocVersionId !== null) {
    const priorData = parseProposalData(existingProposal.proposalData);
    const priorVersionId = priorData.collaborationDocVersionId;
    if (priorVersionId !== undefined && priorData.collaborationDocId) {
      const proposalTemplate = await resolveProposalTemplate(
        processInstance.instanceData as DecisionInstanceData | null,
        processInstance.processId,
      );
      const fragmentNames = proposalTemplate
        ? getProposalFragmentNames(proposalTemplate)
        : ['default'];
      waitUntil(
        invalidateCachedDocumentFragments({
          docId: priorData.collaborationDocId,
          versionId: priorVersionId,
          fragmentNames,
        }),
      );
    }
  }

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
      logger.error('[updateProposal] Failed to create TipTap version', {
        collaborationDocId: parsed.collaborationDocId,
        error,
      });
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
