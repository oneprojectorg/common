import {
  type EmailRecipient,
  listProfileRecipients,
  listUserRecipient,
} from '@op/common';
import { selectEmailRecipients } from '@op/common/client';
import { db, eq } from '@op/db/client';
import { posts, profiles, proposals, users } from '@op/db/schema';
import { Events, inngest } from '@op/events';
import { logger } from '@op/logging';

const { contentFlagged } = Events;

type Recipient = {
  /** Sign-in addresses of the accounts behind the flagged item's author. */
  candidates: Array<EmailRecipient>;
  name: string | null;
  contentType: 'post' | 'proposal' | 'comment' | 'account';
};

/**
 * Resolves the author's delivery addresses + display name for the flagged
 * item. Returns null when the item or its author can't be found (deleted,
 * anonymous, etc.). The display name still comes from the profile; the
 * addresses come from `auth.users` through the recipient resolver.
 */
const resolveRecipient = async (
  itemType: string,
  itemId: string,
): Promise<Recipient | null> => {
  if (itemType === 'post') {
    const [row] = await db
      .select({
        authorProfileId: profiles.id,
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
      candidates: row.authorProfileId
        ? await listProfileRecipients({ profileId: row.authorProfileId })
        : [],
      name: row.name,
      contentType: row.parentPostId ? 'comment' : 'post',
    };
  }

  if (itemType === 'proposal') {
    const [row] = await db
      .select({ authorProfileId: profiles.id, name: profiles.name })
      .from(proposals)
      .leftJoin(profiles, eq(proposals.submittedByProfileId, profiles.id))
      .where(eq(proposals.id, itemId))
      .limit(1);
    if (!row) {
      return null;
    }
    return {
      candidates: row.authorProfileId
        ? await listProfileRecipients({ profileId: row.authorProfileId })
        : [],
      name: row.name,
      contentType: 'proposal',
    };
  }

  if (itemType === 'user') {
    // Flagged accounts arrive as a `users.id`, not a profile.
    const [row] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, itemId))
      .limit(1);
    if (!row) {
      return null;
    }
    const recipient = await listUserRecipient({ userId: itemId });

    return {
      candidates: recipient ? [recipient] : [],
      name: row.name,
      contentType: 'account',
    };
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
      const [recipientEmail] = recipient
        ? selectEmailRecipients(recipient.candidates)
        : [];

      if (!recipient || !recipientEmail) {
        logger.info('No recipient email for flagged content', {
          itemType,
          itemId,
        });
        return;
      }

      const { OPNodemailer, ContentFlaggedEmail } = await import('@op/emails');

      await OPNodemailer({
        to: recipientEmail,
        subject: `Your ${recipient.contentType} has been flagged`,
        component: () =>
          ContentFlaggedEmail({
            recipientName: recipient.name ?? undefined,
            contentType: recipient.contentType,
          }),
      });
    });

    return { notified: true };
  },
);
