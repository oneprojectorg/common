import PostHogClient from '@op/analytics/client';

import {
  type DecisionCommonProperties,
  getDecisionCommonProperties,
} from './client-utils';

const posthog = PostHogClient();

/**
 * Analytics utility functions for tracking user events
 */

export interface AnalyticsEvent {
  distinctId: string;
  event: string;
  properties?: Record<string, any>;
}

export interface AnalyticsIdentify {
  distinctId: string;
  properties?: Record<string, any>;
}

/**
 * Track a single analytics event
 */
export async function trackEvent({
  distinctId,
  event,
  properties,
}: AnalyticsEvent): Promise<void> {
  posthog.capture({
    distinctId,
    event,
    properties,
  });
}

/**
 * Track event with context-aware distinct_id
 * Use this when you have access to the tRPC context with analyticsDistinctId.
 * Errors are caught and logged so analytics never breaks the calling flow.
 */
export async function trackEventWithContext(
  userId: string,
  event: string,
  properties?: Record<string, any>,
): Promise<void> {
  try {
    await trackEvent({
      distinctId: userId,
      event,
      properties,
    });
  } catch (err) {
    console.error(`Failed to track ${event}`, err);
  }
}

/**
 * Set person properties
 */
export async function identifyUser({
  distinctId,
  properties,
}: AnalyticsIdentify): Promise<void> {
  posthog.identify({
    distinctId,
    properties,
  });
}

/**
 * Track multiple events in sequence
 */
export async function trackEvents(events: AnalyticsEvent[]): Promise<void> {
  if (events.length === 0) return;

  events.forEach(({ distinctId, event, properties }) => {
    posthog.capture({
      distinctId,
      event,
      properties,
    });
  });
}

/**
 * Track image upload analytics
 */
export async function trackImageUpload(
  userId: string,
  imageType: 'profile' | 'banner',
  isEdit: boolean,
): Promise<void> {
  const eventName =
    imageType === 'profile'
      ? isEdit
        ? 'profile_picture_successfully_edited'
        : 'profile_picture_successfully_uploaded'
      : isEdit
        ? 'banner_picture_successfully_edited'
        : 'banner_picture_successfully_uploaded';

  await trackEventWithContext(userId, eventName, undefined);
}

/**
 * Track user post creation with media analysis
 */
export async function trackUserPost(
  userId: string,
  content: string,
  attachments: Array<{ metadata: { mimetype: string } } | any>,
): Promise<void> {
  const hasFile = attachments.length > 0;
  const hasText = content.trim().length > 0;

  let mediaType = 'text_only';
  const properties: Record<string, any> = {};

  if (hasFile) {
    const firstFile = attachments[0];
    const mimeType = firstFile?.metadata?.mimetype;

    if (mimeType?.startsWith('image/')) {
      mediaType = 'image';
    } else if (mimeType?.startsWith('video/')) {
      mediaType = 'video';
    } else if (mimeType === 'application/pdf') {
      mediaType = 'pdf';
    } else {
      mediaType = 'file';
    }
    if (mimeType) properties.file_type = mimeType;
  } else {
    // Check for links in content
    const linkRegex = /https?:\/\/[^\s]+/g;
    const links = content.match(linkRegex);
    if (links && links.length > 0) {
      mediaType = 'link';
      properties.links_count = links.length;
    }
  }

  properties.has_text = hasText;
  properties.text_length = content.trim().length;

  await trackEventWithContext(userId, 'user_posted', {
    media: mediaType,
    ...properties,
  });
}

/**
 * Track funding toggle changes
 */
export async function trackFundingToggle(
  options: {
    organizationId: string;
  },
  changes: {
    isOfferingFunds?: boolean;
    isReceivingFunds?: boolean;
  },
): Promise<void> {
  const events: AnalyticsEvent[] = [];

  // Track individual toggle events
  if (changes.isOfferingFunds !== undefined) {
    events.push({
      distinctId: options.organizationId,
      event: 'toggle_offering_funding',
      properties: {
        enabled: changes.isOfferingFunds,
        organizationId: options.organizationId,
      },
    });
  }

  if (changes.isReceivingFunds !== undefined) {
    events.push({
      distinctId: options.organizationId,
      event: 'toggle_seeking_funding',
      properties: {
        enabled: changes.isReceivingFunds,
        organizationId: options.organizationId,
      },
    });
  }

  // Track events if any
  if (events.length > 0) {
    await trackEvents(events);
  }

  // Note: User identification with funding properties is now handled
  // automatically by the withAnalytics middleware
}

/**
 * Track relationship events
 */
export async function trackRelationshipAdded(
  userId: string,
  relationships: string[],
): Promise<void> {
  const events: AnalyticsEvent[] = [];
  const distinctId = userId;

  // Track general relationship add event
  events.push({
    distinctId,
    event: 'user_added_relationship',
    properties: {
      relationship_types: relationships,
      relationship_count: relationships.length,
    },
  });

  // Track specific funding relationships
  relationships.forEach((relationship) => {
    if (relationship === 'funding' || relationship === 'funds') {
      events.push({
        distinctId,
        event: 'user_added_relationship',
        properties: { type: 'funds' },
      });
    } else if (relationship === 'fundedBy' || relationship === 'fundedby') {
      events.push({
        distinctId,
        event: 'user_added_relationship',
        properties: { type: 'fundedby' },
      });
    } else if (relationship === 'mutualfunding') {
      events.push({
        distinctId,
        event: 'user_added_relationship',
        properties: { type: 'mutualfunding' },
      });
    }
  });

  await trackEvents(events);
}

/**
 * Track relationship acceptance
 */
export async function trackRelationshipAccepted(userId: string): Promise<void> {
  await trackEventWithContext(userId, 'user_accepted_relationship', undefined);
}

/**
 * Decision-making process analytics
 */

// Re-exported from the client-safe module so there is a single definition
// shared by server-side tracking here and client-side tracking in the app.
export { type DecisionCommonProperties, getDecisionCommonProperties };

/**
 * Track when a user views a decision-making process
 */
export async function trackProcessViewed(
  userId: string,
  processId: string,
  additionalProps?: Record<string, any>,
): Promise<void> {
  await trackEventWithContext(
    userId,
    'process_viewed',
    getDecisionCommonProperties({
      decisionInstanceId: processId,
      additionalProps,
    }),
  );
}

/**
 * Track when a user submits a proposal
 */
export async function trackProposalSubmitted(
  userId: string,
  processId: string,
  proposalId: string,
  additionalProps?: Record<string, any>,
): Promise<void> {
  await trackEventWithContext(
    userId,
    'proposal_submitted',
    getDecisionCommonProperties({
      decisionInstanceId: processId,
      proposalId,
      additionalProps,
    }),
  );
}

/**
 * Track when a user views a proposal
 */
export async function trackProposalViewed(
  userId: string,
  processId: string,
  proposalId: string,
  additionalProps?: Record<string, any>,
): Promise<void> {
  await trackEventWithContext(
    userId,
    'proposal_viewed',
    getDecisionCommonProperties({
      decisionInstanceId: processId,
      proposalId,
      additionalProps,
    }),
  );
}

/**
 * Track when a user comments on a proposal
 */
export async function trackProposalCommented(
  userId: string,
  processId: string,
  proposalId: string,
  additionalProps?: Record<string, any>,
): Promise<void> {
  await trackEventWithContext(
    userId,
    'proposal_commented',
    getDecisionCommonProperties({
      decisionInstanceId: processId,
      proposalId,
      additionalProps,
    }),
  );
}

/**
 * Track when a user likes a proposal
 */
export async function trackProposalLiked(
  userId: string,
  processId: string,
  proposalId: string,
  additionalProps?: Record<string, any>,
): Promise<void> {
  await trackEventWithContext(
    userId,
    'proposal_liked',
    getDecisionCommonProperties({
      decisionInstanceId: processId,
      proposalId,
      additionalProps,
    }),
  );
}

/**
 * Track when a user follows a proposal
 */
export async function trackProposalFollowed(
  userId: string,
  processId: string,
  proposalId: string,
  additionalProps?: Record<string, any>,
): Promise<void> {
  await trackEventWithContext(
    userId,
    'proposal_followed',
    getDecisionCommonProperties({
      decisionInstanceId: processId,
      proposalId,
      additionalProps,
    }),
  );
}

export async function trackUserVoted(
  userId: string,
  processId: string,
): Promise<void> {
  await trackEventWithContext(
    userId,
    'user_voted',
    getDecisionCommonProperties({ decisionInstanceId: processId }),
  );
}

/**
 * Track a reviewer's first draft save on an assignment (PENDING → IN_PROGRESS)
 */
export async function trackReviewStarted(
  userId: string,
  processId: string,
  proposalId: string,
  additionalProps?: Record<string, unknown>,
): Promise<void> {
  await trackEventWithContext(
    userId,
    'review_started',
    getDecisionCommonProperties({
      decisionInstanceId: processId,
      proposalId,
      additionalProps,
    }),
  );
}

/**
 * Track when a reviewer asks the author to revise a proposal
 */
export async function trackRevisionRequested(
  userId: string,
  processId: string,
  proposalId: string,
  additionalProps?: Record<string, unknown>,
): Promise<void> {
  await trackEventWithContext(
    userId,
    'review_revision_requested',
    getDecisionCommonProperties({
      decisionInstanceId: processId,
      proposalId,
      additionalProps,
    }),
  );
}

/**
 * Track when an author resubmits a proposal in response to a revision request
 */
export async function trackRevisionResponseSubmitted(
  userId: string,
  processId: string,
  proposalId: string,
  additionalProps?: Record<string, unknown>,
): Promise<void> {
  await trackEventWithContext(
    userId,
    'review_revision_submitted',
    getDecisionCommonProperties({
      decisionInstanceId: processId,
      proposalId,
      additionalProps,
    }),
  );
}

/**
 * Track when a reviewer submits a review for one proposal
 */
export async function trackReviewSubmitted(
  userId: string,
  processId: string,
  proposalId: string,
  additionalProps?: Record<string, any>,
): Promise<void> {
  await trackEventWithContext(
    userId,
    'review_submitted',
    getDecisionCommonProperties({
      decisionInstanceId: processId,
      proposalId,
      additionalProps,
    }),
  );
}

/**
 * Track when a reviewer finishes their entire review assignment list for a process
 */
export async function trackReviewQueueCompleted(
  userId: string,
  processId: string,
  additionalProps?: Record<string, any>,
): Promise<void> {
  await trackEventWithContext(
    userId,
    'review_queue_completed',
    getDecisionCommonProperties({
      decisionInstanceId: processId,
      additionalProps,
    }),
  );
}

/**
 * Track when an admin publishes a decision process (DRAFT -> PUBLISHED)
 */
export async function trackAdminSetProcess(
  userId: string,
  processId: string,
  additionalProps?: Record<string, any>,
): Promise<void> {
  await trackEventWithContext(
    userId,
    'admin_set_process',
    getDecisionCommonProperties({
      decisionInstanceId: processId,
      additionalProps,
    }),
  );
}

/**
 * Track when an admin invites participants to a profile (e.g. a decision process)
 */
export async function trackAdminInvitedParticipants(
  userId: string,
  profileId: string,
  invitationCount: number,
  additionalProps?: Record<string, any>,
): Promise<void> {
  await trackEventWithContext(userId, 'admin_invited_participants', {
    profile_id: profileId,
    invitation_count: invitationCount,
    ...additionalProps,
  });
}

/**
 * Track when an admin assigns decision permissions to a role
 */
export async function trackAdminGaveRoles(
  userId: string,
  roleId: string,
  additionalProps?: Record<string, any>,
): Promise<void> {
  await trackEventWithContext(userId, 'admin_gave_roles', {
    role_id: roleId,
    ...additionalProps,
  });
}

/**
 * Track when an admin saves a review rubric for a decision process
 */
export async function trackAdminSetRubric(
  userId: string,
  processId: string,
  additionalProps?: Record<string, any>,
): Promise<void> {
  await trackEventWithContext(
    userId,
    'admin_set_rubric',
    getDecisionCommonProperties({
      decisionInstanceId: processId,
      additionalProps,
    }),
  );
}

/**
 * Track when a user invites others to the platform / organization
 */
export async function trackUserInvited(
  userId: string,
  inviteCount: number,
  additionalProps?: Record<string, any>,
): Promise<void> {
  await trackEventWithContext(userId, 'user_invited', {
    invite_count: inviteCount,
    ...additionalProps,
  });
}

/**
 * Manual transition analytics
 */

export async function trackManualTransitionConfirmed(
  userId: string,
  processId: string,
  additionalProps?: Record<string, any>,
): Promise<void> {
  await trackEventWithContext(
    userId,
    'manual_transition_confirmed',
    getDecisionCommonProperties({
      decisionInstanceId: processId,
      additionalProps,
    }),
  );
}

export async function trackManualSelectionSubmitted(
  userId: string,
  processId: string,
  additionalProps?: Record<string, any>,
): Promise<void> {
  await trackEventWithContext(
    userId,
    'manual_selection_submitted',
    getDecisionCommonProperties({
      decisionInstanceId: processId,
      additionalProps,
    }),
  );
}

export async function trackPhaseEndDateChanged(
  userId: string,
  processId: string,
  additionalProps?: Record<string, any>,
): Promise<void> {
  await trackEventWithContext(
    userId,
    'phase_end_date_changed',
    getDecisionCommonProperties({
      decisionInstanceId: processId,
      additionalProps,
    }),
  );
}
