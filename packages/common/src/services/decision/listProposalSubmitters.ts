import { and, db, eq, inArray, isNull, ne } from '@op/db/client';
import {
  ProposalStatus,
  Visibility,
  objectsInStorage,
  profileUsers,
  profiles,
  proposals,
  users,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import {
  getActiveNonDraftIdsForInstance,
  getProposalIdsForPhase,
} from './getProposalsForPhase';
import { isLegacyInstanceData } from './isLegacyInstance';

export interface ListProposalSubmittersInput {
  processInstanceId: string;
}

/**
 * Returns unique submitter profiles for non-draft, visible proposals
 * in the current phase of a decision instance. Includes every collaborator
 * attached to a proposal's profile (creator + invitees) so collaborative
 * proposals contribute multiple faces to the participation face-pile.
 */
export const listProposalSubmitters = async ({
  input,
  user,
}: {
  input: ListProposalSubmittersInput;
  user: User;
}) => {
  const { processInstanceId } = input;

  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: {
      id: true,
      profileId: true,
      ownerProfileId: true,
      instanceData: true,
      processId: true,
      currentStateId: true,
    },
  });

  if (!instance?.profileId) {
    throw new UnauthorizedError('User does not have access to this process');
  }

  await assertInstanceProfileAccess({
    user,
    instance,
    profilePermissions: { decisions: permission.READ },
    orgFallbackPermissions: { decisions: permission.READ },
  });

  const phaseProposalIds =
    isLegacyInstanceData(instance.instanceData) || !instance.currentStateId
      ? await getActiveNonDraftIdsForInstance({
          instanceId: processInstanceId,
        })
      : await getProposalIdsForPhase({
          instance,
          phaseId: instance.currentStateId,
        });

  if (phaseProposalIds.length === 0) {
    return { submitters: [] };
  }

  const rows = await db
    .selectDistinct({
      slug: profiles.slug,
      name: profiles.name,
      avatarName: objectsInStorage.name,
    })
    .from(proposals)
    .innerJoin(profileUsers, eq(profileUsers.profileId, proposals.profileId))
    .innerJoin(users, eq(users.authUserId, profileUsers.authUserId))
    .innerJoin(profiles, eq(profiles.id, users.profileId))
    .leftJoin(objectsInStorage, eq(profiles.avatarImageId, objectsInStorage.id))
    .where(
      and(
        eq(proposals.processInstanceId, processInstanceId),
        ne(proposals.status, ProposalStatus.DRAFT),
        eq(proposals.visibility, Visibility.VISIBLE),
        isNull(proposals.deletedAt),
        inArray(proposals.id, phaseProposalIds),
      ),
    );

  return {
    submitters: rows.map((row) => ({
      slug: row.slug,
      name: row.name ?? null,
      avatarImage: row.avatarName ? { name: row.avatarName } : null,
    })),
  };
};
