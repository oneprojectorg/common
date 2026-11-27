import { db } from '@op/db/client';
import {
  type Activity,
  type Profile,
  activities,
  posts,
  profiles,
} from '@op/db/schema';
import { Events } from '@op/events';
import { eq } from 'drizzle-orm';

const EXCERPT_LENGTH = 280;

export interface RecordProposalCommentActivityInput {
  idempotencyKey: string;
  postId: string;
  proposalId: string;
  authorProfileId: string;
}

export interface ProposalCommentActivityContext {
  proposalTitle: string;
  processName: string;
  decisionSlug: string | null;
  proposalProfileId: string;
  commenterName: string;
  commentContent: string;
  submittedByProfileId: string | null;
  submittedBy: Pick<Profile, 'id' | 'type' | 'name'> | null;
}

export const recordProposalCommentActivity = async ({
  idempotencyKey,
  postId,
  proposalId,
  authorProfileId,
}: RecordProposalCommentActivityInput): Promise<{
  activity: Activity;
  context: ProposalCommentActivityContext;
} | null> => {
  const [proposal, commenter, comment] = await Promise.all([
    db.query.proposals.findFirst({
      where: { id: proposalId },
      with: {
        profile: true,
        submittedBy: true,
        processInstance: { with: { profile: true } },
      },
    }),
    db
      .select({ name: profiles.name })
      .from(profiles)
      .where(eq(profiles.id, authorProfileId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({ content: posts.content })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  if (!proposal || !proposal.profile || !commenter || !comment) {
    return null;
  }

  const proposalTitle = proposal.profile.name ?? 'Proposal';
  const context: ProposalCommentActivityContext = {
    proposalTitle,
    processName: proposal.processInstance?.name ?? 'Decision Making Process',
    decisionSlug: proposal.processInstance?.profile?.slug ?? null,
    proposalProfileId: proposal.profileId,
    commenterName: commenter.name,
    commentContent: comment.content ?? '',
    submittedByProfileId: proposal.submittedByProfileId,
    submittedBy: proposal.submittedBy
      ? {
          id: proposal.submittedBy.id,
          type: proposal.submittedBy.type,
          name: proposal.submittedBy.name,
        }
      : null,
  };

  const snapshot = {
    commenterName: context.commenterName,
    proposalTitle,
    processName: context.processName,
    decisionSlug: context.decisionSlug,
    proposalProfileId: context.proposalProfileId,
    commentExcerpt: context.commentContent.slice(0, EXCERPT_LENGTH),
  };

  const [inserted] = await db
    .insert(activities)
    .values({
      idempotencyKey,
      actorId: authorProfileId,
      verb: Events.proposalCommentPosted.name,
      objectType: 'post',
      objectId: postId,
      targetType: 'proposal',
      targetId: proposalId,
      snapshot,
    })
    .onConflictDoNothing({ target: activities.idempotencyKey })
    .returning();

  const activity =
    inserted ??
    (await db
      .select()
      .from(activities)
      .where(eq(activities.idempotencyKey, idempotencyKey))
      .limit(1)
      .then((rows) => rows[0]));

  if (!activity) {
    return null;
  }

  return { activity, context };
};
