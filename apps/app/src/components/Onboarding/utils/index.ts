import posthog from 'posthog-js';

export const sendOnboardingAnalytics = (data: {
  isOfferingFunds?: boolean;
  isReceivingFunds?: boolean;
}) => {
  posthog.setPersonProperties({
    is_offering_funds: data.isOfferingFunds,
    is_seeking_funds: data.isReceivingFunds,
  });
};
