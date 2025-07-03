export interface SendInvitationEmailParams {
  to: string;
  inviterName: string;
  organizationName: string;
  inviteUrl?: string;
}

export const sendInvitationEmail = async ({
  to,
  inviterName,
  organizationName,
  inviteUrl = 'https://common.oneproject.org/signup',
}: SendInvitationEmailParams): Promise<void> => {
  // Use dynamic imports to avoid build issues with workspace dependencies
  const { OPNodemailer } = await import('@op/emails');
  const { OPInvitationEmail } = await import('@op/emails');

  await OPNodemailer({
    to,
    from: `${organizationName} via Common <support@oneproject.org>`,
    subject: `Action Required: ${inviterName} invited you to join ${organizationName} on Common`,
    component: () =>
      OPInvitationEmail({
        inviterName,
        organizationName,
        inviteUrl,
      }),
  });
};
