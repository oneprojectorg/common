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
  const { default: OPInvitationEmail } = await import(
    '@op/emails/emails/OPInvitationEmail'
  );

  await OPNodemailer({
    to,
    subject: OPInvitationEmail.subject,
    component: () =>
      OPInvitationEmail({
        inviterName,
        organizationName,
        inviteUrl,
      }),
  });
};
