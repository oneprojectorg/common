'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';

import { OnboardingFlow } from '@/components/Onboarding';
import { OnboardingFlowV2 } from '@/components/OnboardingV2';

export const TransitionalOnboardingFlow = () => {
  const isOnboardingV2Enabled = useFeatureFlag('onboarding-v2');

  return isOnboardingV2Enabled ? <OnboardingFlowV2 /> : <OnboardingFlow />;
};
