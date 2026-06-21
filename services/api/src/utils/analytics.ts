import {
  trackEventWithContext,
  trackFundingToggle as trackFundingToggleOriginal,
  trackImageUpload as trackImageUploadOriginal,
  trackManualSelectionSubmitted as trackManualSelectionSubmittedOriginal,
  trackManualTransitionConfirmed as trackManualTransitionConfirmedOriginal,
  trackProposalCommented as trackProposalCommentedOriginal,
  trackProposalFollowed as trackProposalFollowedOriginal,
  trackProposalLiked as trackProposalLikedOriginal,
  trackProposalSubmitted as trackProposalSubmittedOriginal,
  trackRelationshipAccepted as trackRelationshipAcceptedOriginal,
  trackRelationshipAdded as trackRelationshipAddedOriginal,
  trackUserPost as trackUserPostOriginal,
} from '@op/analytics';

/**
 * Analytics utilities that automatically inject the user ID for consistent identification
 * This keeps the common service library clean while ensuring all analytics calls use user.id
 *
 * Callable from both the authoritative-auth (`TContextWithUser`) and the
 * local-verify (`TContextWithClaimsUser`) procedure tiers — only `user.id` is
 * read, which both shapes carry.
 */
type AnalyticsContext = { user: { id: string } };

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
 * Generic event tracking with automatic context injection
 */
export const trackEvent = (
  ctx: AnalyticsContext,
  event: string,
  properties?: Record<string, any>,
) => {
  return trackEventWithContext(ctx.user.id, event, properties);
};
