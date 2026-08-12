import { and, asc, count, db, eq, notExists } from '@op/db/client';
import {
  authUsers,
  decisionsVoteSubmissions,
  objectsInStorage,
  profileUsers,
  profiles,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import { PARTICIPANT_FACE_PILE_MAX } from './schemas/participantProfile';

/**
 * Returns the profiles that have actually submitted a vote in the process.
 * Admin-only: process admins see the participation list, no one else does.
 *
 * Deliberately uncached: submitVote broadcasts on `Channels.decisionVoters` so
 * subscribed clients refetch, but nothing on that path invalidates the
 * `decision` cache — caching here would serve a stale roster to exactly the
 * refetch the broadcast triggered.
 */
export const listVoters = async ({
  processInstanceId,
  user,
}: {
  processInstanceId: string;
  user: User;
}) => {
  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: { id: true, profileId: true, ownerProfileId: true },
  });

  // `profileId` is still nullable for legacy instances that predate the
  // per-instance profile, so a missing one is indistinguishable from a missing
  // instance as far as an unauthorized caller should be able to tell — same
  // denial for both, before any access check reveals which it was.
  if (!instance?.profileId) {
    throw new UnauthorizedError('User does not have access to this process');
  }

  // Matches every other admin-gated decision endpoint: admins granted on the
  // instance profile OR on the owning organization.
  await assertInstanceProfileAccess({
    user,
    instance,
    profilePermissions: { decisions: permission.ADMIN },
    orgFallbackPermissions: { decisions: permission.ADMIN },
  });

  // Anonymous accounts are excluded from both the faces and the total, so the
  // roster has one meaning throughout: the voters an admin can actually
  // identify. A profile counts as anonymous when *any* attached auth user is,
  // matching how getProposal/listProposals derive their `isAnonymous` flag.
  // Correlated anti-join rather than a join, so a profile with several
  // profileUsers rows still yields exactly one row per voter.
  const notAnonymous = notExists(
    db
      .select({ id: profileUsers.id })
      .from(profileUsers)
      .innerJoin(authUsers, eq(authUsers.id, profileUsers.authUserId))
      .where(
        and(
          eq(
            profileUsers.profileId,
            decisionsVoteSubmissions.submittedByProfileId,
          ),
          eq(authUsers.isAnonymous, true),
        ),
      ),
  );

  const scope = and(
    eq(decisionsVoteSubmissions.processInstanceId, processInstanceId),
    notAnonymous,
  );

  // `decisions_vote_submissions` is unique on (process_instance_id,
  // submitted_by_profile_id) and both joins are on primary keys, so each voter
  // yields exactly one row — no DISTINCT needed for either query.
  const [rows, totalRows] = await Promise.all([
    // Faces: earliest voters first so the sample is stable across requests
    // rather than at the mercy of the planner's row order.
    db
      .select({
        slug: profiles.slug,
        name: profiles.name,
        avatarName: objectsInStorage.name,
      })
      .from(decisionsVoteSubmissions)
      .innerJoin(
        profiles,
        eq(profiles.id, decisionsVoteSubmissions.submittedByProfileId),
      )
      .leftJoin(
        objectsInStorage,
        eq(profiles.avatarImageId, objectsInStorage.id),
      )
      .where(scope)
      .orderBy(
        asc(decisionsVoteSubmissions.createdAt),
        asc(decisionsVoteSubmissions.id),
      )
      .limit(PARTICIPANT_FACE_PILE_MAX),

    db.select({ value: count() }).from(decisionsVoteSubmissions).where(scope),
  ]);

  return {
    voters: rows.map((row) => ({
      slug: row.slug,
      name: row.name ?? null,
      avatarImage: row.avatarName ? { name: row.avatarName } : null,
    })),
    total: Number(totalRows[0]?.value ?? 0),
  };
};
