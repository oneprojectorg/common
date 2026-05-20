import { db, eq } from '@op/db/client';
import {
  decisionsVoteSubmissions,
  objectsInStorage,
  profiles,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { CommonError, UnauthorizedError } from '../../utils';
import { getProfileAccessUser } from '../access';

export interface ListVotersInput {
  processInstanceId: string;
}

/**
 * Returns the profiles that have actually submitted a vote in the process.
 * Admin-only: process admins see the participation list, no one else does.
 */
export const listVoters = async ({
  input,
  user,
}: {
  input: ListVotersInput;
  user: User;
}) => {
  const { processInstanceId } = input;

  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: { id: true, profileId: true },
  });

  if (!instance) {
    throw new UnauthorizedError('User does not have access to this process');
  }

  if (!instance.profileId) {
    throw new CommonError(
      'Decision instance does not have an associated profile',
    );
  }

  const profileUser = await getProfileAccessUser({
    user,
    profileId: instance.profileId,
  });

  assertAccess({ decisions: permission.ADMIN }, profileUser?.roles ?? []);

  const rows = await db
    .selectDistinct({
      slug: profiles.slug,
      name: profiles.name,
      avatarName: objectsInStorage.name,
    })
    .from(decisionsVoteSubmissions)
    .innerJoin(
      profiles,
      eq(profiles.id, decisionsVoteSubmissions.submittedByProfileId),
    )
    .leftJoin(objectsInStorage, eq(profiles.avatarImageId, objectsInStorage.id))
    .where(eq(decisionsVoteSubmissions.processInstanceId, processInstanceId));

  return {
    voters: rows.map((row) => ({
      slug: row.slug,
      name: row.name ?? null,
      avatarImage: row.avatarName ? { name: row.avatarName } : null,
    })),
  };
};
