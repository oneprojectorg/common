import PostHogClient from './client';

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
  await posthog.shutdown();
}

/**
 * Track event with context-aware distinct_id
 * Use this when you have access to the tRPC context with analyticsDistinctId
 */
export async function trackEventWithContext(
  userId: string,
  event: string,
  properties?: Record<string, any>,
): Promise<void> {
  await trackEvent({
    distinctId: userId,
    event,
    properties,
  });
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
  await posthog.shutdown();
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
  await posthog.shutdown();
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

export interface DecisionCommonProperties {
  process_id: string;
  proposal_id?: string;
  location?: string;
  timezone?: string;
  language?: string;
}

/**
 * Helper function to get common properties for decision events
 */
export function getDecisionCommonProperties(
  processId: string,
  proposalId?: string,
  additionalProps?: Record<string, any>,
): DecisionCommonProperties & Record<string, any> {
  // Server-side safe implementation - only add client-side properties if available
  const baseProps: DecisionCommonProperties & Record<string, any> = {
    process_id: processId,
    timestamp: new Date().toISOString(),
    ...additionalProps,
  };

  if (proposalId) {
    baseProps.proposal_id = proposalId;
  }

  // Only add browser-specific properties if we're on the client side
  if (typeof window !== 'undefined') {
    baseProps.location = window.location.href;
    baseProps.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    baseProps.language = navigator.language;
  }

  return baseProps;
}

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
    getDecisionCommonProperties(processId, undefined, additionalProps),
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
    getDecisionCommonProperties(processId, proposalId, additionalProps),
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
    getDecisionCommonProperties(processId, proposalId, additionalProps),
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
    getDecisionCommonProperties(processId, proposalId, additionalProps),
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
    getDecisionCommonProperties(processId, proposalId, additionalProps),
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
    getDecisionCommonProperties(processId, proposalId, additionalProps),
  );
}

/**
 * Track when a user votes on a proposal
 */
export async function trackUserVoted(
  userId: string,
  processId: string,
  proposalId: string,
  voteData?: Record<string, any>,
  additionalProps?: Record<string, any>,
): Promise<void> {
  await trackEvent({
    distinctId: userId,
    event: 'user_voted',
    properties: getDecisionCommonProperties(processId, proposalId, {
      ...voteData,
      ...additionalProps,
    }),
  });
}
