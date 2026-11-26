import type { TransactionType } from '@op/db/client';
import { profileUserToAccessRoles, profileUsers } from '@op/db/schema';

import { CommonError } from '../../utils';

interface ProposalCoauthor {
  profileId: string;
  authUserId: string;
  email: string | null;
}

/**
 * Inserts one membership per co-author on its proposal profile, each with the
 * given role. The caller makes sure no membership exists yet.
 */
export async function insertProposalCoauthors({
  tx,
  coauthors,
  roleId,
}: {
  tx: TransactionType;
  coauthors: ProposalCoauthor[];
  roleId: string;
}): Promise<void> {
  if (coauthors.length === 0) {
    return;
  }

  const insertedCoauthors = await tx
    .insert(profileUsers)
    .values(coauthors)
    .returning({ id: profileUsers.id });

  if (insertedCoauthors.length !== coauthors.length) {
    throw new CommonError('Failed to add the co-authors of the proposal');
  }

  await tx.insert(profileUserToAccessRoles).values(
    insertedCoauthors.map((coauthor) => ({
      profileUserId: coauthor.id,
      accessRoleId: roleId,
    })),
  );
}
