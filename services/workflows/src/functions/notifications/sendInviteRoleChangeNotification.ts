import { Events, inngest } from '@op/events';

const { profileInviteRoleChanged } = Events;

export const sendInviteRoleChangeNotification = inngest.createFunction(
  {
    id: 'sendInviteRoleChangeNotification',
  },
  { event: profileInviteRoleChanged.name },
  async ({ event, step }) => {
    const { email, newRoleName, profileName } =
      profileInviteRoleChanged.schema.parse(event.data);

    await step.run('send-invite-role-change-email', async () => {
      const { OPNodemailer } = await import('@op/emails');
      const { InviteRoleChangedEmail } = await import('@op/emails');

      await OPNodemailer({
        to: email,
        subject: `Your invite role for ${profileName} has been updated`,
        component: () =>
          InviteRoleChangedEmail({
            profileName,
            newRoleName,
          }),
      });
    });

    return { message: 'Invite role change notification sent' };
  },
);
