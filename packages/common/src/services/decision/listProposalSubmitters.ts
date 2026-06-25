import { cache } from '@op/cache';
import { type SQL, and, db, eq, inArray, isNull, ne } from '@op/db/client';
import {
  ProposalStatus,
  Visibility,
  authUsers,
  objectsInStorage,
  profileUsers,
  profiles,
  proposals,
  users,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';
import { countDistinct } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { UnauthorizedError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import { getProposalIdsForPhase } from './getProposalsForPhase';
import { PROPOSAL_SUBMITTER_FACE_PILE_MAX } from './schemas/proposal';

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
  user: User | undefined;
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

  // The face-pile data is viewer-independent; the READ gate stays outside the
  // cache so a hit can never bypass authorization.
  return cache({
    type: 'decision',
    params: [processInstanceId, 'submitters'],
    fetch: async () => {
      const phaseProposalIds = await getProposalIdsForPhase({ instance });

      if (phaseProposalIds.length === 0) {
        return { submitters: [], total: 0 };
      }

      const scope: SQL = and(
        eq(proposals.processInstanceId, processInstanceId),
        ne(proposals.status, ProposalStatus.DRAFT),
        eq(proposals.visibility, Visibility.VISIBLE),
        isNull(proposals.deletedAt),
        inArray(proposals.id, phaseProposalIds),
      )!;

      // auth.users and public.users share the table name "users"; alias the
      // auth table so joining both in one query doesn't collide on the "users"
      // alias.
      const submitterAuthUser = alias(authUsers, 'submitter_auth_user');

      const [faceRows, totalRows] = await Promise.all([
        // Faces: registered (non-anonymous) accounts that uploaded an avatar.
        db
          .selectDistinct({
            slug: profiles.slug,
            name: profiles.name,
            avatarName: objectsInStorage.name,
          })
          .from(proposals)
          .innerJoin(
            profileUsers,
            eq(profileUsers.profileId, proposals.profileId),
          )
          .innerJoin(users, eq(users.authUserId, profileUsers.authUserId))
          .innerJoin(
            submitterAuthUser,
            eq(submitterAuthUser.id, profileUsers.authUserId),
          )
          .innerJoin(profiles, eq(profiles.id, users.profileId))
          .innerJoin(
            objectsInStorage,
            eq(profiles.avatarImageId, objectsInStorage.id),
          )
          .where(and(scope, eq(submitterAuthUser.isAnonymous, false)))
          .limit(PROPOSAL_SUBMITTER_FACE_PILE_MAX),

        // Total: every distinct submitter in scope, including anonymous
        // accounts. A submitter is uniquely identified by authUserId, so the
        // count needs no join to users/profiles.
        db
          .select({ value: countDistinct(profileUsers.authUserId) })
          .from(proposals)
          .innerJoin(
            profileUsers,
            eq(profileUsers.profileId, proposals.profileId),
          )
          .where(scope),
      ]);

      return {
        submitters: faceRows.map((row) => ({
          slug: row.slug,
          name: row.name ?? null,
          avatarImage: row.avatarName ? { name: row.avatarName } : null,
        })),
        total: Number(totalRows[0]?.value ?? 0),
      };
    },
  });
};
