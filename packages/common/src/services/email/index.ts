export interface SendInvitationEmailParams {
  to: string;
  inviterName: string;
  organizationName: string;
  inviteUrl?: string;
  message?: string;
}

export const sendInvitationEmail = async ({
  to,
  inviterName,
  organizationName,
  inviteUrl = 'https://common.oneproject.org/signup',
  message,
}: SendInvitationEmailParams): Promise<void> => {
  // Use dynamic imports to avoid build issues with workspace dependencies
  const { OPNodemailer } = await import('@op/emails');
  const { OPInvitationEmail } = await import('@op/emails');

  await OPNodemailer({
    to,
    from: `${organizationName ?? inviterName} via Common`,
    subject: `Action Required: ${inviterName} invited you to join ${organizationName} on Common`,
    component: () =>
      OPInvitationEmail({
        inviterName,
        organizationName,
        inviteUrl,
        message,
      }),
  });
};
