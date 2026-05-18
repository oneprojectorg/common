import {
  trackAdminGaveRoles as trackAdminGaveRolesOriginal,
  trackAdminInvitedParticipants as trackAdminInvitedParticipantsOriginal,
  trackAdminSetProcess as trackAdminSetProcessOriginal,
  trackAdminSetRubric as trackAdminSetRubricOriginal,
  trackEventWithContext,
  trackFundingToggle as trackFundingToggleOriginal,
  trackImageUpload as trackImageUploadOriginal,
  trackManualSelectionSubmitted as trackManualSelectionSubmittedOriginal,
  trackManualTransitionConfirmed as trackManualTransitionConfirmedOriginal,
  trackProcessViewed as trackProcessViewedOriginal,
  trackProposalCommented as trackProposalCommentedOriginal,
  trackProposalFollowed as trackProposalFollowedOriginal,
  trackProposalLiked as trackProposalLikedOriginal,
  trackProposalReviewed as trackProposalReviewedOriginal,
  trackProposalSubmitted as trackProposalSubmittedOriginal,
  trackProposalViewed as trackProposalViewedOriginal,
  trackRelationshipAccepted as trackRelationshipAcceptedOriginal,
  trackRelationshipAdded as trackRelationshipAddedOriginal,
  trackReviewListFinished as trackReviewListFinishedOriginal,
  trackUserInvited as trackUserInvitedOriginal,
  trackUserPost as trackUserPostOriginal,
  trackUserVoted as trackUserVotedOriginal,
} from '@op/analytics';

import type { TContextWithUser } from '../types';

/**
 * Analytics utilities that automatically inject the user ID for consistent identification
 * This keeps the common service library clean while ensuring all analytics calls use user.id
 */

type AnalyticsContext = TContextWithUser;

/**
 * Track a proposal being liked with automatic context injection
 */
export const trackProposalLiked = (
  ctx: AnalyticsContext,
  processId: string,
  proposalId: string,
  additionalProps?: Record<string, any>,
) => {
  return trackProposalLikedOriginal(
    ctx.user.id,
    processId,
    proposalId,
    additionalProps,
  );
};

/**
 * Track a proposal being followed with automatic context injection
 */
export const trackProposalFollowed = (
  ctx: AnalyticsContext,
  processId: string,
  proposalId: string,
  additionalProps?: Record<string, any>,
) => {
  return trackProposalFollowedOriginal(
    ctx.user.id,
    processId,
    proposalId,
    additionalProps,
  );
};

/**
 * Track a process being viewed with automatic context injection
 */
export const trackProcessViewed = (
  ctx: AnalyticsContext,
  processId: string,
  additionalProps?: Record<string, any>,
) => {
  return trackProcessViewedOriginal(ctx.user.id, processId, additionalProps);
};

/**
 * Track a proposal being viewed with automatic context injection
 */
export const trackProposalViewed = (
  ctx: AnalyticsContext,
  processId: string,
  proposalId: string,
  additionalProps?: Record<string, any>,
) => {
  return trackProposalViewedOriginal(
    ctx.user.id,
    processId,
    proposalId,
    additionalProps,
  );
};

/**
 * Track a proposal comment with automatic context injection
 */
export const trackProposalCommented = (
  ctx: AnalyticsContext,
  processId: string,
  proposalId: string,
  additionalProps?: Record<string, any>,
) => {
  return trackProposalCommentedOriginal(
    ctx.user.id,
    processId,
    proposalId,
    additionalProps,
  );
};

/**
 * Track a proposal submission with automatic context injection
 */
export const trackProposalSubmitted = (
  ctx: AnalyticsContext,
  processId: string,
  proposalId: string,
  additionalProps?: Record<string, any>,
) => {
  return trackProposalSubmittedOriginal(
    ctx.user.id,
    processId,
    proposalId,
    additionalProps,
  );
};

/**
 * Track image upload with automatic context injection
 */
export const trackImageUpload = (
  ctx: AnalyticsContext,
  imageType: 'profile' | 'banner',
  isEdit: boolean,
) => {
  return trackImageUploadOriginal(ctx.user.id, imageType, isEdit);
};

/**
 * Track user post with automatic context injection
 */
export const trackUserPost = (
  ctx: AnalyticsContext,
  content: string,
  attachments: Array<{ metadata: { mimetype: string } } | any>,
) => {
  return trackUserPostOriginal(ctx.user.id, content, attachments);
};

/**
 * Track relationship added with automatic context injection
 */
export const trackRelationshipAdded = (
  ctx: AnalyticsContext,
  relationships: string[],
) => {
  return trackRelationshipAddedOriginal(ctx.user.id, relationships);
};

/**
 * Track relationship accepted with automatic context injection
 */
export const trackRelationshipAccepted = (ctx: AnalyticsContext) => {
  return trackRelationshipAcceptedOriginal(ctx.user.id);
};

/**
 * Track funding toggle with automatic context injection
 */
export const trackFundingToggle = (
  organizationContext: { organizationId: string },
  fundingStatus: {
    isOfferingFunds?: boolean;
    isReceivingFunds?: boolean;
  },
) => {
  return trackFundingToggleOriginal(organizationContext, fundingStatus);
};

/**
 * Track manual selection submission with automatic context injection
 */
export const trackManualSelectionSubmitted = (
  ctx: AnalyticsContext,
  processId: string,
  additionalProps?: Record<string, any>,
) => {
  return trackManualSelectionSubmittedOriginal(
    ctx.user.id,
    processId,
    additionalProps,
  );
};

/**
 * Track manual transition confirmed with automatic context injection
 */
export const trackManualTransitionConfirmed = (
  ctx: AnalyticsContext,
  processId: string,
  additionalProps?: Record<string, any>,
) => {
  return trackManualTransitionConfirmedOriginal(
    ctx.user.id,
    processId,
    additionalProps,
  );
};

/**
 * Track a user submitting a vote with automatic context injection
 */
export const trackUserVoted = (
  ctx: AnalyticsContext,
  processId: string,
  proposalId: string,
  voteData?: Record<string, any>,
  additionalProps?: Record<string, any>,
) => {
  return trackUserVotedOriginal(
    ctx.user.id,
    processId,
    proposalId,
    voteData,
    additionalProps,
  );
};

/**
 * Track a user submitting a single proposal review with automatic context injection
 */
export const trackProposalReviewed = (
  ctx: AnalyticsContext,
  processId: string,
  proposalId: string,
  additionalProps?: Record<string, any>,
) => {
  return trackProposalReviewedOriginal(
    ctx.user.id,
    processId,
    proposalId,
    additionalProps,
  );
};

/**
 * Track a user finishing their entire review assignment list for a process
 */
export const trackReviewListFinished = (
  ctx: AnalyticsContext,
  processId: string,
  additionalProps?: Record<string, any>,
) => {
  return trackReviewListFinishedOriginal(
    ctx.user.id,
    processId,
    additionalProps,
  );
};

/**
 * Track an admin publishing a decision process with automatic context injection
 */
export const trackAdminSetProcess = (
  ctx: AnalyticsContext,
  processId: string,
  additionalProps?: Record<string, any>,
) => {
  return trackAdminSetProcessOriginal(ctx.user.id, processId, additionalProps);
};

/**
 * Track an admin inviting participants to a profile with automatic context injection
 */
export const trackAdminInvitedParticipants = (
  ctx: AnalyticsContext,
  profileId: string,
  invitationCount: number,
  additionalProps?: Record<string, any>,
) => {
  return trackAdminInvitedParticipantsOriginal(
    ctx.user.id,
    profileId,
    invitationCount,
    additionalProps,
  );
};

/**
 * Track an admin assigning decision permissions to a role with automatic context injection
 */
export const trackAdminGaveRoles = (
  ctx: AnalyticsContext,
  roleId: string,
  additionalProps?: Record<string, any>,
) => {
  return trackAdminGaveRolesOriginal(ctx.user.id, roleId, additionalProps);
};

/**
 * Track an admin saving a review rubric with automatic context injection
 */
export const trackAdminSetRubric = (
  ctx: AnalyticsContext,
  processId: string,
  additionalProps?: Record<string, any>,
) => {
  return trackAdminSetRubricOriginal(ctx.user.id, processId, additionalProps);
};

/**
 * Track a user invitation with automatic context injection
 */
export const trackUserInvited = (
  ctx: AnalyticsContext,
  inviteCount: number,
  additionalProps?: Record<string, any>,
) => {
  return trackUserInvitedOriginal(ctx.user.id, inviteCount, additionalProps);
};

/**
 * Generic event tracking with automatic context injection
 */
export const trackEvent = (
  ctx: AnalyticsContext,
  event: string,
  properties?: Record<string, any>,
) => {
  return trackEventWithContext(ctx.user.id, event, properties);
};
