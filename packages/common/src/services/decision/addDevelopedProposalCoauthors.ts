import type { TransactionType } from '@op/db/client';

import { getDecisionAdmins } from './getDecisionAdmins';
import { insertProposalCoauthors } from './insertProposalCoauthors';

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

  await insertProposalCoauthors({
    tx,
    coauthors: coauthors.map(({ authUserId, email }) => ({
      profileId: proposalProfileId,
      authUserId,
      email,
    })),
    roleId: authorRoleId,
  });

  return coauthors.map((coauthor) => coauthor.authUserId);
}
