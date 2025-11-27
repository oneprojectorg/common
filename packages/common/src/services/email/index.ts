import {
  CommentNotificationEmail,
  OPBatchSend,
  OPInvitationEmail,
  OPNodemailer,
  OPRelationshipRequestEmail,
} from '@op/emails';
import { relationshipMap } from '@op/types';

export interface SendInvitationEmailParams {
  to: string;
  inviterName: string;
  organizationName?: string;
  inviteUrl?: string;
  message?: string;
}

export const sendInvitationEmail = async ({
  to,
  inviterName,
  organizationName,
  inviteUrl = 'https://common.oneproject.org/',
  message,
}: SendInvitationEmailParams): Promise<void> => {
  await OPNodemailer({
    to,
    from: `${organizationName ?? inviterName} via Common`,
    subject: `Action Required: ${inviterName} invited you to join ${organizationName ? `${organizationName} on Common` : 'Common'}`,
    component: () =>
      OPInvitationEmail({
        inviterName,
        organizationName: organizationName || 'Common',
        inviteUrl,
        message,
      }),
  });
};

export interface BatchInvitationEmailParams {
  invitations: Array<{
    to: string;
    inviterName: string;
    organizationName?: string;
    inviteUrl?: string;
    message?: string;
  }>;
}

export const sendBatchInvitationEmails = async ({
  invitations,
}: BatchInvitationEmailParams): Promise<{
  successful: string[];
  failed: { email: string; error: any }[];
}> => {
  if (invitations.length === 0) {
    return { successful: [], failed: [] };
  }

  const batchEmails = invitations.map(
    ({
      to,
      inviterName,
      organizationName,
      inviteUrl = 'https://common.oneproject.org/',
      message,
    }) => ({
      to,
      from: `${organizationName ?? inviterName} via Common`,
      subject: `Action Required: ${inviterName} invited you to join ${organizationName ? `${organizationName} on Common` : 'Common'}`,
      component: () =>
        OPInvitationEmail({
          inviterName,
          organizationName: organizationName || 'Common',
          inviteUrl,
          message,
        }),
    }),
  );

  const { errors } = await OPBatchSend(batchEmails);

  const successful = invitations
    .filter(
      (invitation) => !errors?.some((error) => error.email === invitation.to),
    )
    .map((invitation) => invitation.to);

  return { successful, failed: errors || [] };
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
  const relationshipLabels = relationshipTypes.map(
    (type) => relationshipMap[type]?.noun || type,
  );
  const inverseRelationshipLabels = relationshipTypes.map(
    (type) => relationshipMap[type]?.inverse || type,
  );
  const relationshipText =
    relationshipLabels.length === 1
      ? relationshipLabels[0]
      : relationshipLabels.join('/');

  await OPNodemailer({
    to,
    from: `${requesterOrgName} via Common`,
    subject: `Action Required: Accept request for ${targetOrgName} to add ${requesterOrgName} as a ${relationshipText} on Common`,
    component: () =>
      OPRelationshipRequestEmail({
        requesterOrgName,
        targetOrgName,
        relationshipTypes: inverseRelationshipLabels,
        approvalUrl,
        requesterMessage,
      }),
  });
};

export const sendCommentNotificationEmail = async ({
  to,
  commenterName,
  postContent,
  commentContent,
  postUrl,
  recipientName,
  contentType = 'post',
  contextName,
  postedIn,
}: {
  to: string;
  commenterName: string;
  postContent: string;
  commentContent: string;
  postUrl: string;
  recipientName?: string;
  contentType?: 'post' | 'proposal';
  contextName?: string;
  postedIn?: string;
}): Promise<void> => {
  const subject = `${commenterName} commented on your ${contentType}`;

  await OPNodemailer({
    to,
    from: `${commenterName} via Common`,
    subject,
    component: () =>
      CommentNotificationEmail({
        commenterName,
        postContent,
        commentContent,
        postUrl,
        recipientName,
        contentType,
        contextName,
        postedIn,
      }),
  });
};
