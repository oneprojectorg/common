import PostHogClient from './client';

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
  properties: Record<string, any>;
}

/**
 * Track a single analytics event
 */
export async function trackEvent({
  distinctId,
  event,
  properties,
}: AnalyticsEvent): Promise<void> {
  const posthog = PostHogClient();
  posthog.capture({
    distinctId,
    event,
    properties,
  });
  await posthog.shutdown();
}

/**
 * Set person properties
 */
export async function identifyUser({
  distinctId,
  properties,
}: AnalyticsIdentify): Promise<void> {
  const posthog = PostHogClient();
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

  const posthog = PostHogClient();
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

  await trackEvent({
    distinctId: userId,
    event: eventName,
  });
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

  await trackEvent({
    distinctId: userId,
    event: 'user_posted',
    properties: {
      media: mediaType,
      ...properties,
    },
  });
}

/**
 * Track funding toggle changes and update person properties
 */
export async function trackFundingToggle(
  userId: string,
  options: {
    organizationId: string;
  },
  changes: {
    isOfferingFunds?: boolean;
    isReceivingFunds?: boolean;
  },
  currentState: {
    isOfferingFunds: boolean;
    isReceivingFunds: boolean;
  },
): Promise<void> {
  const events: AnalyticsEvent[] = [];

  // Track individual toggle events
  if (changes.isOfferingFunds !== undefined) {
    events.push({
      distinctId: options.organizationId,
      event: 'toggle_offering_funding',
      properties: { enabled: changes.isOfferingFunds },
    });
  }

  if (changes.isReceivingFunds !== undefined) {
    events.push({
      distinctId: options.organizationId,
      event: 'toggle_seeking_funding',
      properties: { enabled: changes.isReceivingFunds },
    });
  }

  // Track events if any
  if (events.length > 0) {
    await trackEvents(events);
  }

  // Update person properties
  const isOffering = changes.isOfferingFunds ?? currentState.isOfferingFunds;
  const isSeeking = changes.isReceivingFunds ?? currentState.isReceivingFunds;

  let userFunding = 'Neither';
  if (isOffering && isSeeking) {
    userFunding = 'OfferingandSeeking';
  } else if (isOffering) {
    userFunding = 'Offering_Funding';
  } else if (isSeeking) {
    userFunding = 'Seeking_Funding';
  }

  await identifyUser({
    distinctId: userId,
    properties: {
      is_offering_funds: isOffering,
      is_seeking_funds: isSeeking,
      user_funding: userFunding,
    },
  });
}

/**
 * Track relationship events
 */
export async function trackRelationshipAdded(
  userId: string,
  relationships: string[],
): Promise<void> {
  const events: AnalyticsEvent[] = [];

  // Track general relationship add event
  events.push({
    distinctId: userId,
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
        distinctId: userId,
        event: 'user_added_relationship',
        properties: { type: 'funds' },
      });
    } else if (relationship === 'fundedBy' || relationship === 'fundedby') {
      events.push({
        distinctId: userId,
        event: 'user_added_relationship',
        properties: { type: 'fundedby' },
      });
    } else if (relationship === 'mutualfunding') {
      events.push({
        distinctId: userId,
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
  await trackEvent({
    distinctId: userId,
    event: 'user_accepted_relationship',
  });
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
  await trackEvent({
    distinctId: userId,
    event: 'process_viewed',
    properties: getDecisionCommonProperties(processId, undefined, additionalProps),
  });
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
  await trackEvent({
    distinctId: userId,
    event: 'proposal_submitted',
    properties: getDecisionCommonProperties(processId, proposalId, additionalProps),
  });
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
  await trackEvent({
    distinctId: userId,
    event: 'proposal_viewed',
    properties: getDecisionCommonProperties(processId, proposalId, additionalProps),
  });
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
  await trackEvent({
    distinctId: userId,
    event: 'proposal_commented',
    properties: getDecisionCommonProperties(processId, proposalId, additionalProps),
  });
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
  await trackEvent({
    distinctId: userId,
    event: 'proposal_liked',
    properties: getDecisionCommonProperties(processId, proposalId, additionalProps),
  });
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
  await trackEvent({
    distinctId: userId,
    event: 'proposal_followed',
    properties: getDecisionCommonProperties(processId, proposalId, additionalProps),
  });
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
