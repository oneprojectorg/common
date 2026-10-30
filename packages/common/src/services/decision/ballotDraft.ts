import { db } from '@op/db/client';
import { type DecisionsVoteDraft, decisionsVoteDrafts } from '@op/db/schema';

import { NotFoundError } from '../../utils';
import { getIndividualProfileId } from '../access';

interface DraftKey {
  processInstanceId: string;
  authUserId: string;
}

export async function findBallotDraft({
  processInstanceId,
  authUserId,
}: DraftKey): Promise<DecisionsVoteDraft | null> {
  const profileId = await getIndividualProfileId(authUserId);
  const draft = await db.query.decisionsVoteDrafts.findFirst({
    where: { processInstanceId, profileId },
  });
  return draft ?? null;
}

export async function ensureBallotDraft({
  processInstanceId,
  authUserId,
}: DraftKey): Promise<DecisionsVoteDraft> {
  const profileId = await getIndividualProfileId(authUserId);
  await db
    .insert(decisionsVoteDrafts)
    .values({ processInstanceId, profileId })
    .onConflictDoNothing();
  const draft = await db.query.decisionsVoteDrafts.findFirst({
    where: { processInstanceId, profileId },
  });

  if (!draft) {
    throw new NotFoundError('Ballot draft', processInstanceId);
  }

  return draft;
}
