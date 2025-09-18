import {
  trackProposalLiked as trackProposalLikedOriginal,
  trackProposalFollowed as trackProposalFollowedOriginal,
  trackProposalViewed as trackProposalViewedOriginal,
  trackProposalCommented as trackProposalCommentedOriginal,
  trackProposalSubmitted as trackProposalSubmittedOriginal,
  trackProcessViewed as trackProcessViewedOriginal,
  trackImageUpload as trackImageUploadOriginal,
  trackUserPost as trackUserPostOriginal,
  trackRelationshipAdded as trackRelationshipAddedOriginal,
  trackRelationshipAccepted as trackRelationshipAcceptedOriginal,
  trackFundingToggle as trackFundingToggleOriginal,
  trackEventWithContext,
} from '@op/analytics';
import type { TContextWithAnalytics, TContextWithUser } from '../types';

/**
 * Analytics utilities that automatically inject the analytics distinct_id from tRPC context
 * This keeps the common service library clean while ensuring all analytics calls use the context
 */

type AnalyticsContext = TContextWithUser & TContextWithAnalytics;

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
    ctx.analyticsDistinctId,
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
    ctx.analyticsDistinctId,
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
  return trackProcessViewedOriginal(
    ctx.user.id,
    processId,
    additionalProps,
    ctx.analyticsDistinctId,
  );
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
    ctx.analyticsDistinctId,
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
    ctx.analyticsDistinctId,
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
    ctx.analyticsDistinctId,
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
  return trackImageUploadOriginal(
    ctx.user.id,
    imageType,
    isEdit,
    ctx.analyticsDistinctId,
  );
};

/**
 * Track user post with automatic context injection
 */
export const trackUserPost = (
  ctx: AnalyticsContext,
  content: string,
  attachments: Array<{ metadata: { mimetype: string } } | any>,
) => {
  return trackUserPostOriginal(
    ctx.user.id,
    content,
    attachments,
    ctx.analyticsDistinctId,
  );
};

/**
 * Track relationship added with automatic context injection
 */
export const trackRelationshipAdded = (
  ctx: AnalyticsContext,
  relationships: string[],
) => {
  return trackRelationshipAddedOriginal(
    ctx.user.id,
    relationships,
    ctx.analyticsDistinctId,
  );
};

/**
 * Track relationship accepted with automatic context injection
 */
export const trackRelationshipAccepted = (
  ctx: AnalyticsContext,
) => {
  return trackRelationshipAcceptedOriginal(
    ctx.user.id,
    ctx.analyticsDistinctId,
  );
};

/**
 * Track funding toggle with automatic context injection
 */
export const trackFundingToggle = (
  ctx: AnalyticsContext,
  organizationContext: { organizationId: string },
  fundingStatus: {
    isOfferingFunds?: boolean;
    isReceivingFunds?: boolean;
  },
) => {
  return trackFundingToggleOriginal(
    organizationContext,
    fundingStatus,
    ctx.analyticsDistinctId,
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
  return trackEventWithContext(
    ctx.user.id,
    event,
    properties,
    ctx.analyticsDistinctId,
  );
};