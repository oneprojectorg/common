import { OPBatchSend, OPInvitationEmail } from '@op/emails';
import { Events, inngest } from '@op/events';

const { profileInviteSent } = Events;

export const sendProfileInviteEmails = inngest.createFunction(
  {
    id: 'sendProfileInviteEmails',
  },
  { event: profileInviteSent.name },
  async ({ event, step }) => {
    const { invitations, senderProfileId } = profileInviteSent.schema.parse(
      event.data,
    );

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

    return {
      message: `${result.sent} profile invite email(s) sent, ${result.failed} failed`,
    };
  },
);
