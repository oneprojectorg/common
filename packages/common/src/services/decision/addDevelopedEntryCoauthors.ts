import type { TransactionType } from '@op/db/client';
import { profileUserToAccessRoles, profileUsers } from '@op/db/schema';

import { CommonError } from '../../utils';
import { assertGlobalRole } from '../assert';

/**
 * Makes every reviewer with a live assignment on one of the sources a
 * co-author of the new entry: a member of its proposal profile with the
 * Member role, as an accepted proposal invite writes. Returns the auth user
 * ids it added, so the caller can drop their access cache after the commit.
 */
export async function addDevelopedEntryCoauthors({
  tx,
  processInstanceId,
  sourceProposalIds,
  proposalProfileId,
  authorAuthUserId,
}: {
  tx: TransactionType;
  processInstanceId: string;
  sourceProposalIds: string[];
  proposalProfileId: string;
  authorAuthUserId: string;
}): Promise<string[]> {
  const assignments = await tx.query.proposalReviewAssignments.findMany({
    where: {
      processInstanceId,
      proposalId: { in: sourceProposalIds },
      deletedAt: { isNull: true },
    },
    columns: {},
    with: {
      reviewer: {
        columns: {},
        with: {
          account: {
            columns: { authUserId: true },
            orderBy: { createdAt: 'asc', id: 'asc' },
            with: { authUser: { columns: { email: true } } },
          },
        },
      },
    },
  });

  const emailByAuthUserId = new Map<string, string | null>();
  for (const { reviewer } of assignments) {
    const account = reviewer.account;
    if (!account || account.authUserId === authorAuthUserId) {
      continue;
    }
    emailByAuthUserId.set(account.authUserId, account.authUser.email);
  }

  if (emailByAuthUserId.size === 0) {
    return [];
  }

  const memberRole = await assertGlobalRole('Member', tx);

  const coauthors = await tx
    .insert(profileUsers)
    .values(
      [...emailByAuthUserId].map(([authUserId, email]) => ({
        profileId: proposalProfileId,
        authUserId,
        email,
      })),
    )
    .returning({ id: profileUsers.id, authUserId: profileUsers.authUserId });

  if (coauthors.length !== emailByAuthUserId.size) {
    throw new CommonError('Failed to add the co-authors of the entry');
  }

  await tx.insert(profileUserToAccessRoles).values(
    coauthors.map((coauthor) => ({
      profileUserId: coauthor.id,
      accessRoleId: memberRole.id,
    })),
  );

  return coauthors.map((coauthor) => coauthor.authUserId);
}
