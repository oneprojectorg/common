import posthog from 'posthog-js';

import { FormValues } from '../';

export const sendOnboardingAnalytics = (data: FormValues) => {
  posthog.setPersonProperties({
    is_offering_funds: data.isOfferingFunds,
    is_seeking_funds: data.isReceivingFunds,
  });
};
