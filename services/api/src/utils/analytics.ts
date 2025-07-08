import PostHogClient from '../posthog';

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
export async function trackEvent({ distinctId, event, properties }: AnalyticsEvent): Promise<void> {
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
export async function identifyUser({ distinctId, properties }: AnalyticsIdentify): Promise<void> {
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
export async function trackImageUpload(userId: string, imageType: 'profile' | 'banner', isEdit: boolean): Promise<void> {
  const eventName = imageType === 'profile'
    ? (isEdit ? 'profile_picture_successfully_edited' : 'profile_picture_successfully_uploaded')
    : (isEdit ? 'banner_picture_successfully_edited' : 'banner_picture_successfully_uploaded');
  
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
  attachments: Array<{ metadata: { mimetype: string } }>
): Promise<void> {
  const hasFile = attachments.length > 0;
  const hasText = content.trim().length > 0;
  
  let mediaType = 'text_only';
  const properties: Record<string, any> = {};
  
  if (hasFile) {
    const firstFile = attachments[0];
    const mimeType = firstFile.metadata.mimetype;
    
    if (mimeType.startsWith('image/')) {
      mediaType = 'image';
    } else if (mimeType.startsWith('video/')) {
      mediaType = 'video';
    } else if (mimeType === 'application/pdf') {
      mediaType = 'pdf';
    } else {
      mediaType = 'file';
    }
    properties.file_type = mimeType;
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
  changes: {
    isOfferingFunds?: boolean;
    isReceivingFunds?: boolean;
  },
  currentState: {
    isOfferingFunds: boolean;
    isReceivingFunds: boolean;
  }
): Promise<void> {
  const events: AnalyticsEvent[] = [];
  
  // Track individual toggle events
  if (changes.isOfferingFunds !== undefined) {
    events.push({
      distinctId: userId,
      event: 'toggle_offering_funding',
      properties: { enabled: changes.isOfferingFunds },
    });
  }
  
  if (changes.isReceivingFunds !== undefined) {
    events.push({
      distinctId: userId,
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
export async function trackRelationshipAdded(userId: string, relationships: string[]): Promise<void> {
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
  relationships.forEach(relationship => {
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