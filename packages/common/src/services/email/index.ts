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
    subject: `Action Required: ${inviterName} invited you to join ${organizationName ? `${organizationName} on Common` : 'Common'}`,
    component: () =>
      OPInvitationEmail({
        inviterName,
        organizationName,
        inviteUrl,
        message,
      }),
  });
};

export interface SendRelationshipRequestEmailParams {
  to: string;
  requesterOrgName: string;
  targetOrgName: string;
  relationshipTypes: string[];
  approvalUrl: string;
  requesterMessage?: string;
}

export const sendRelationshipRequestEmail = async ({
  to,
  requesterOrgName,
  targetOrgName,
  relationshipTypes,
  approvalUrl,
  requesterMessage,
}: SendRelationshipRequestEmailParams): Promise<void> => {
  // Use dynamic imports to avoid build issues with workspace dependencies
  const { OPNodemailer } = await import('@op/emails');
  const { OPRelationshipRequestEmail } = await import('@op/emails');

  await OPNodemailer({
    to,
    from: `${requesterOrgName} via Common`,
    subject: `New relationship request from ${requesterOrgName}`,
    component: () =>
      OPRelationshipRequestEmail({
        requesterOrgName,
        targetOrgName,
        relationshipTypes,
        approvalUrl,
        requesterMessage,
      }),
  });
};
