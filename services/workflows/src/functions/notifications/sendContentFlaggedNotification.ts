import { db, eq } from '@op/db/client';
import { posts, profiles, proposals, users } from '@op/db/schema';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

const { contentFlagged } = Events;

type Recipient = {
  email: string | null;
  name: string | null;
  contentType: 'post' | 'proposal' | 'comment' | 'account';
};

/**
 * Resolves the author's email + display name for the flagged item. Returns
 * null when the item or its author can't be found (deleted, anonymous, etc.).
 */
const resolveRecipient = async (
  itemType: string,
  itemId: string,
): Promise<Recipient | null> => {
  if (itemType === 'post') {
    const [row] = await db
      .select({
        email: profiles.email,
        name: profiles.name,
        parentPostId: posts.parentPostId,
      })
      .from(posts)
      .leftJoin(profiles, eq(posts.profileId, profiles.id))
      .where(eq(posts.id, itemId))
      .limit(1);
    if (!row) {
      return null;
    }
    return {
      email: row.email,
      name: row.name,
      contentType: row.parentPostId ? 'comment' : 'post',
    };
  }

  if (itemType === 'proposal') {
    const [row] = await db
      .select({ email: profiles.email, name: profiles.name })
      .from(proposals)
      .leftJoin(profiles, eq(proposals.submittedByProfileId, profiles.id))
      .where(eq(proposals.id, itemId))
      .limit(1);
    if (!row) {
      return null;
    }
    return { email: row.email, name: row.name, contentType: 'proposal' };
  }

  if (itemType === 'user') {
    const [row] = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, itemId))
      .limit(1);
    if (!row) {
      return null;
    }
    return { email: row.email, name: row.name, contentType: 'account' };
  }

  return null;
};

/**
 * Emails the author when their content is flagged.
 */
export const sendContentFlaggedNotification = inngest.createFunction(
  { id: 'sendContentFlaggedNotification' },
  { event: contentFlagged.name },
  async ({ event, step }) => {
    const { itemType, itemId } = contentFlagged.schema.parse(event.data);

    await step.run('send-flagged-email', async () => {
      const recipient = await resolveRecipient(itemType, itemId);
      if (!recipient?.email) {
        logger.info('No recipient email for flagged content', {
          itemType,
          itemId,
        });
        return;
      }

      const { OPBatchSend, ContentFlaggedEmail } = await import('@op/emails');

      const { errors } = await OPBatchSend([
        {
          to: recipient.email,
          subject: `Your ${recipient.contentType} has been flagged`,
          component: () =>
            ContentFlaggedEmail({
              recipientName: recipient.name ?? undefined,
              contentType: recipient.contentType,
            }),
        },
      ]);

      if (errors.length > 0) {
        throw new Error(`Email send failed: ${JSON.stringify(errors)}`);
      }
    });

    return { notified: true };
  },
);
