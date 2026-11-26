import type { TransactionType } from '@op/db/client';
import { profileUserToAccessRoles, profileUsers } from '@op/db/schema';

import { CommonError } from '../../utils';
import { getDecisionAdmins } from './getDecisionAdmins';

/**
 * Makes every admin of the decision a co-author of the new developed
 * proposal: a member of its proposal profile with the role the author holds.
 * Returns the auth user ids it added, so the caller can drop their access
 * cache after the commit.
 */
export async function addDevelopedProposalCoauthors({
  tx,
  decisionProfileId,
  proposalProfileId,
  authorAuthUserId,
  authorRoleId,
}: {
  tx: TransactionType;
  decisionProfileId: string;
  proposalProfileId: string;
  authorAuthUserId: string;
  authorRoleId: string;
}): Promise<string[]> {
  const admins = await getDecisionAdmins({
    decisionProfileId,
    dbClient: tx,
  });
  const coauthors = admins.filter(
    (admin) => admin.authUserId !== authorAuthUserId,
  );

  if (coauthors.length === 0) {
    return [];
  }

  const insertedCoauthors = await tx
    .insert(profileUsers)
    .values(
      coauthors.map(({ authUserId, email }) => ({
        profileId: proposalProfileId,
        authUserId,
        email,
      })),
    )
    .returning({ id: profileUsers.id, authUserId: profileUsers.authUserId });

  if (insertedCoauthors.length !== coauthors.length) {
    throw new CommonError('Failed to add the co-authors of the proposal');
  }

  await tx.insert(profileUserToAccessRoles).values(
    insertedCoauthors.map((coauthor) => ({
      profileUserId: coauthor.id,
      accessRoleId: authorRoleId,
    })),
  );

  return insertedCoauthors.map((coauthor) => coauthor.authUserId);
}
