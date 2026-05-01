import type { AnalyticsEvent, AnalyticsIdentify } from './utils';

/** Default analytics test shim. All operations are no-ops. */
export const analyticsMock = {
  reset(): void {},
};

/** Minimal PostHog-compatible client used in tests. */
export function PostHogClient() {
  return {
    capture(_event: AnalyticsEvent) {},
    identify(_identity: AnalyticsIdentify) {},
    async shutdown() {},
  };
}

export async function trackEvent(_event: AnalyticsEvent): Promise<void> {}

export async function trackEventWithContext(
  _userId: string,
  _event: string,
  _properties?: Record<string, any>,
): Promise<void> {}

export async function identifyUser(
  _identity: AnalyticsIdentify,
): Promise<void> {}

export async function trackEvents(_events: AnalyticsEvent[]): Promise<void> {}

export async function trackImageUpload(
  _userId: string,
  _imageType: 'profile' | 'banner',
  _isEdit: boolean,
): Promise<void> {}

export async function trackUserPost(
  _userId: string,
  _content: string,
  _attachments: Array<{ metadata: { mimetype: string } } | any>,
): Promise<void> {}

export async function trackFundingToggle(
  _options: { organizationId: string },
  _changes: { isOfferingFunds?: boolean; isReceivingFunds?: boolean },
): Promise<void> {}

export async function trackRelationshipAdded(
  _userId: string,
  _relationships: string[],
): Promise<void> {}

export async function trackRelationshipAccepted(
  _userId: string,
): Promise<void> {}

export function getDecisionCommonProperties(
  _processId: string,
  _proposalId?: string,
  _additionalProps?: Record<string, any>,
) {
  return {} as Record<string, any>;
}

export async function trackProcessViewed(
  _userId: string,
  _processId: string,
  _additionalProps?: Record<string, any>,
): Promise<void> {}

export async function trackProposalSubmitted(
  _userId: string,
  _processId: string,
  _proposalId: string,
  _additionalProps?: Record<string, any>,
): Promise<void> {}

export async function trackProposalViewed(
  _userId: string,
  _processId: string,
  _proposalId: string,
  _additionalProps?: Record<string, any>,
): Promise<void> {}

export async function trackProposalCommented(
  _userId: string,
  _processId: string,
  _proposalId: string,
  _additionalProps?: Record<string, any>,
): Promise<void> {}

export async function trackProposalLiked(
  _userId: string,
  _processId: string,
  _proposalId: string,
  _additionalProps?: Record<string, any>,
): Promise<void> {}

export async function trackProposalFollowed(
  _userId: string,
  _processId: string,
  _proposalId: string,
  _additionalProps?: Record<string, any>,
): Promise<void> {}

export async function trackUserVoted(
  _userId: string,
  _processId: string,
  _proposalId: string,
  _voteData?: Record<string, any>,
  _additionalProps?: Record<string, any>,
): Promise<void> {}

export async function trackManualTransitionInitiated(
  _userId: string,
  _processId: string,
  _additionalProps?: Record<string, any>,
): Promise<void> {}

export async function trackManualTransitionConfirmed(
  _userId: string,
  _processId: string,
  _additionalProps?: Record<string, any>,
): Promise<void> {}

export async function trackManualTransitionDismissed(
  _userId: string,
  _processId: string,
  _additionalProps?: Record<string, any>,
): Promise<void> {}

export async function trackManualSelectionSubmitted(
  _userId: string,
  _processId: string,
  _additionalProps?: Record<string, any>,
): Promise<void> {}

export async function trackPhaseEndDateChanged(
  _userId: string,
  _processId: string,
  _additionalProps?: Record<string, any>,
): Promise<void> {}

export type {
  AnalyticsEvent,
  AnalyticsIdentify,
  DecisionCommonProperties,
} from './utils';
