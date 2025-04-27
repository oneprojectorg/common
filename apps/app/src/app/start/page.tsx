'use client';

import { OnboardingFlow } from '@/components/Onboarding';
import { AuthWrapper } from '@/utils/AuthWrapper';

export default function OnboardingPage() {
  return (
    <AuthWrapper>
      <OnboardingFlow />
    </AuthWrapper>
  );
}
