import { db } from '@op/db/client';
import { profileInvites } from '@op/db/schema';
import { OPBatchSend, OPInvitationEmail } from '@op/emails';
import { Events, inngest } from '@op/events';
import { inArray } from 'drizzle-orm';

const { profileInviteSent } = Events;

export const sendProfileInviteEmails = inngest.createFunction(
  {
    id: 'sendProfileInviteEmails',
  },
  { event: profileInviteSent.name },
  async ({ event, step }) => {
    const { invitations, senderProfileId, inviteIds } =
      profileInviteSent.schema.parse(event.data);

    const result = await step.run('send-profile-invite-emails', async () => {
      console.log(
        `Sending profile invite emails from ${senderProfileId}`,
        invitations.map((i) => i.email),
      );

      const emails = invitations.map(
        ({ email, inviterName, profileName, inviteUrl, personalMessage }) => ({
          to: email,
          from: `${inviterName} via Common`,
          subject: `${inviterName} invited you to join ${profileName}`,
          component: () =>
            OPInvitationEmail({
              inviterName,
              organizationName: profileName,
              inviteUrl,
              message: personalMessage,
            }),
        }),
      );

      const { data, errors } = await OPBatchSend(emails);

      if (errors.length > 0) {
        // Resend batch API by default sends nothing of a batch if there is an error on
        // any of the batch. So we throw to get a retry in the Workflow step
        throw Error(`Email batch failed: ${JSON.stringify(errors)}`);
      }

      return {
        sent: data.length,
        failed: errors.length,
        errors,
      };
    });

    // Mark invites as notified after successful email delivery
    if (inviteIds && inviteIds.length > 0) {
      await step.run('mark-invites-notified', async () => {
        await db
          .update(profileInvites)
          .set({ notifiedAt: new Date().toISOString() })
          .where(inArray(profileInvites.id, inviteIds));
      });
    }

    return {
      message: `${result.sent} profile invite email(s) sent, ${result.failed} failed`,
    };
  },
);
