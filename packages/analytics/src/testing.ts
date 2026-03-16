import type {
  AnalyticsEvent,
  AnalyticsIdentify,
  DecisionCommonProperties,
} from './utils';

/** Default analytics test shim. All operations are no-ops. */
export const analyticsMock = {
  /** Reset the noop mock. */
  reset(): void {
    return;
  },
};

/** Minimal PostHog-compatible client used in tests. */
export function PostHogClient() {
  return {
    capture(_event: AnalyticsEvent) {
      return;
    },
    identify(_identity: AnalyticsIdentify) {
      return;
    },
    async shutdown() {
      return;
    },
  };
}

/** Record a single analytics event without any network traffic. */
export async function trackEvent({
  distinctId: _distinctId,
  event: _event,
  properties: _properties,
}: AnalyticsEvent): Promise<void> {
  return;
}

/** Record a context-aware analytics event for the current user. */
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

/** Record identify calls without touching PostHog. */
export async function identifyUser({
  distinctId: _distinctId,
  properties: _properties,
}: AnalyticsIdentify): Promise<void> {
  return;
}

/** Record multiple analytics events in sequence. */
export async function trackEvents(events: AnalyticsEvent[]): Promise<void> {
  for (const event of events) {
    await trackEvent(event);
  }
}

/** Record image upload analytics for tests. */
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

/** Record user post analytics for tests. */
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

    if (mimeType) {
      properties.file_type = mimeType;
    }
  } else {
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

/** Record funding toggle analytics for tests. */
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

  await trackEvents(events);
}

/** Record relationship creation analytics for tests. */
export async function trackRelationshipAdded(
  userId: string,
  relationships: string[],
): Promise<void> {
  const events: AnalyticsEvent[] = [
    {
      distinctId: userId,
      event: 'user_added_relationship',
      properties: {
        relationship_types: relationships,
        relationship_count: relationships.length,
      },
    },
  ];

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

/** Record relationship acceptance analytics for tests. */
export async function trackRelationshipAccepted(userId: string): Promise<void> {
  await trackEventWithContext(userId, 'user_accepted_relationship', undefined);
}

/** Build shared decision analytics properties without browser side effects. */
export function getDecisionCommonProperties(
  processId: string,
  proposalId?: string,
  additionalProps?: Record<string, any>,
): DecisionCommonProperties & Record<string, any> {
  const baseProps: DecisionCommonProperties & Record<string, any> = {
    process_id: processId,
    timestamp: new Date().toISOString(),
    ...additionalProps,
  };

  if (proposalId) {
    baseProps.proposal_id = proposalId;
  }

  if (typeof window !== 'undefined') {
    baseProps.location = window.location.href;
    baseProps.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    baseProps.language = navigator.language;
  }

  return baseProps;
}

/** Record process view analytics for tests. */
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

/** Record proposal submission analytics for tests. */
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

/** Record proposal view analytics for tests. */
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

/** Record proposal comment analytics for tests. */
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

/** Record proposal like analytics for tests. */
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

/** Record proposal follow analytics for tests. */
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

/** Record voting analytics for tests. */
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

export type {
  AnalyticsEvent,
  AnalyticsIdentify,
  DecisionCommonProperties,
} from './utils';
