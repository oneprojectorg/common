import { and, db, eq } from '@op/db/client';
import { type DecisionBallotDraft, decisionBallotDrafts } from '@op/db/schema';

import { NotFoundError } from '../../utils';
import { getIndividualProfileId } from '../access';

interface DraftKey {
  processInstanceId: string;
  authUserId: string;
}

const draftFilter = (processInstanceId: string, profileId: string) =>
  and(
    eq(decisionBallotDrafts.processInstanceId, processInstanceId),
    eq(decisionBallotDrafts.profileId, profileId),
  );

export async function findBallotDraft({
  processInstanceId,
  authUserId,
}: DraftKey): Promise<DecisionBallotDraft | null> {
  const profileId = await getIndividualProfileId(authUserId);
  const draft = await db.query.decisionBallotDrafts.findFirst({
    where: { processInstanceId, profileId },
  });
  return draft ?? null;
}

export async function findLatestBallotDraft({
  authUserId,
}: {
  authUserId: string;
}): Promise<DecisionBallotDraft | null> {
  const profileId = await getIndividualProfileId(authUserId);
  const [draft] = await db.query.decisionBallotDrafts.findMany({
    where: { profileId },
    orderBy: { updatedAt: 'desc' },
    limit: 1,
  });
  return draft ?? null;
}

export async function ensureBallotDraft({
  processInstanceId,
  authUserId,
}: DraftKey): Promise<DecisionBallotDraft> {
  const profileId = await getIndividualProfileId(authUserId);
  await db
    .insert(decisionBallotDrafts)
    .values({ processInstanceId, profileId })
    .onConflictDoNothing();
  const draft = await db.query.decisionBallotDrafts.findFirst({
    where: { processInstanceId, profileId },
  });

  if (!draft) {
    throw new NotFoundError('Ballot draft', processInstanceId);
  }

  return draft;
}

export async function setBallotPageCursor({
  processInstanceId,
  authUserId,
  pageCursor,
}: DraftKey & { pageCursor: number | null }): Promise<void> {
  const profileId = await getIndividualProfileId(authUserId);
  await db
    .update(decisionBallotDrafts)
    .set({ pageCursor, updatedAt: new Date().toISOString() })
    .where(draftFilter(processInstanceId, profileId));
}

export async function markBallotDraftReopened({
  processInstanceId,
  authUserId,
}: DraftKey): Promise<void> {
  const profileId = await getIndividualProfileId(authUserId);
  await db
    .update(decisionBallotDrafts)
    .set({ reopenedAt: new Date(), updatedAt: new Date().toISOString() })
    .where(draftFilter(processInstanceId, profileId));
}
