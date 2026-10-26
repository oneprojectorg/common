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
  chatLineId,
}: {
  authUserId: string;
  /** Only drafts last browsed on this decision line. */
  chatLineId?: string;
}): Promise<DecisionBallotDraft | null> {
  const profileId = await getIndividualProfileId(authUserId);
  const [draft] = await db.query.decisionBallotDrafts.findMany({
    where: { profileId, ...(chatLineId ? { chatLineId } : {}) },
    orderBy: { updatedAt: 'desc' },
    limit: 1,
  });
  return draft ?? null;
}

export async function ensureBallotDraft({
  processInstanceId,
  authUserId,
  chatLineId,
}: DraftKey & {
  /** The decision line this browse came in on; omitted leaves the stored line as it is. */
  chatLineId?: string | null;
}): Promise<DecisionBallotDraft> {
  const profileId = await getIndividualProfileId(authUserId);
  await db
    .insert(decisionBallotDrafts)
    .values({ processInstanceId, profileId, chatLineId: chatLineId ?? null })
    .onConflictDoUpdate({
      target: [
        decisionBallotDrafts.processInstanceId,
        decisionBallotDrafts.profileId,
      ],
      set:
        chatLineId === undefined
          ? { updatedAt: new Date().toISOString() }
          : { chatLineId, updatedAt: new Date().toISOString() },
    });
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
