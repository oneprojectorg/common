'use client';

import { AuthWrapper } from '@/utils/AuthWrapper';

import { OnboardingFlow } from '@/components/Onboarding';

export default function OnboardingPage() {
  return (
    <AuthWrapper>
      <OnboardingFlow />
    </AuthWrapper>
  );
}
