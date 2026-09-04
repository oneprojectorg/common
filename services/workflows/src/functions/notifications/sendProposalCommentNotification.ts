import { listProfileRecipients } from '@op/common';
import { selectEmailRecipients } from '@op/common/client';
import { OPURLConfig } from '@op/core';
import { db } from '@op/db/client';
import { posts, profiles } from '@op/db/schema';
import { CommentNotificationEmail, OPBatchSend } from '@op/emails';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';
import { eq } from 'drizzle-orm';

const key = 'event.data.authorProfileId + "-" + event.data.proposalId';
const { proposalCommentPosted } = Events;

export const sendProposalCommentNotification = inngest.createFunction(
  {
    id: 'sendProposalCommentNotification',
    debounce: {
      key,
      period: '1m',
      timeout: '5m',
    },
  },
  { event: proposalCommentPosted.name },
  async ({ event, step }) => {
    const { postId, proposalId, authorProfileId } =
      proposalCommentPosted.schema.parse(event.data);

    const [proposal, commenter, comment] = await Promise.all([
      step.run('get-proposal', async () => {
        return db.query.proposals.findFirst({
          where: { id: proposalId },
          with: {
            profile: true,
            processInstance: {
              with: {
                profile: true,
              },
            },
          },
        });
      }),
      step.run('get-commenter', async () => {
        const [row] = await db
          .select({ name: profiles.name })
          .from(profiles)
          .where(eq(profiles.id, authorProfileId))
          .limit(1);
        return row ?? null;
      }),
      step.run('get-comment', async () => {
        const [row] = await db
          .select({ content: posts.content })
          .from(posts)
          .where(eq(posts.id, postId))
          .limit(1);
        return row ?? null;
      }),
    ]);

    if (!proposal || !commenter || !comment) {
      return;
    }

    if (!proposal.profile || !proposal.profileId) {
      return;
    }

    // Don't notify the user about comments on their own proposal.
    if (proposal.profileId === authorProfileId) {
      return;
    }

    const [proposalAuthor, authorRecipients] = await Promise.all([
      step.run('get-proposal-author', async () => {
        const [row] = await db
          .select({ name: profiles.name })
          .from(profiles)
          .where(eq(profiles.id, proposal.submittedByProfileId))
          .limit(1);
        return row ?? null;
      }),
      step.run('get-author-recipients', async () =>
        listProfileRecipients({ profileId: proposal.submittedByProfileId }),
      ),
    ]);

    // One address for a person's proposal; every admin for an org's.
    const recipients = selectEmailRecipients(authorRecipients);

    if (!proposalAuthor || recipients.length === 0) {
      return;
    }

    const decisionSlug = proposal.processInstance?.profile?.slug;
    if (!decisionSlug) {
      logger.error(
        'Cannot build proposal comment URL: proposal has no process instance or decision profile',
        { proposalId },
      );
      return;
    }

    const baseUrl = OPURLConfig('APP').ENV_URL;
    const contentUrl = `${baseUrl}/decisions/${decisionSlug}/proposal/${proposal.profileId}`;

    // Extract proposal content from proposalData; fall back to the profile
    // name for collab-doc proposals whose body lives in TipTap fragments.
    const proposalDataDescription =
      typeof proposal.proposalData === 'object' &&
      proposal.proposalData !== null &&
      'description' in proposal.proposalData &&
      typeof proposal.proposalData.description === 'string'
        ? proposal.proposalData.description
        : null;
    const proposalContent =
      proposalDataDescription ?? proposal.profile.name ?? 'Proposal content';

    const proposalTitle = proposal.profile.name;
    const contextSource = proposalTitle || proposalContent;
    const contextName =
      contextSource.length > 50
        ? `${contextSource.slice(0, 50).trim()}...`
        : contextSource.trim();

    const postedIn =
      proposal.processInstance?.name ?? 'Decision Making Process';

    const result = await step.run('send-email', async () => {
      const { errors } = await OPBatchSend(
        recipients.map((to) => ({
          to,
          from: `${commenter.name} via Common`,
          subject: CommentNotificationEmail.subject(commenter.name, 'proposal'),
          component: () =>
            CommentNotificationEmail({
              commenterName: commenter.name,
              postContent: proposalContent,
              commentContent: comment.content,
              postUrl: contentUrl,
              recipientName: proposalAuthor.name,
              contentType: 'proposal',
              contextName,
              postedIn,
            }),
        })),
      );

      if (errors.length > 0) {
        throw new Error(`Email send failed: ${JSON.stringify(errors)}`);
      }

      return { sent: recipients.length };
    });

    return {
      message: `${result.sent} proposal comment notification(s) sent`,
    };
  },
);
