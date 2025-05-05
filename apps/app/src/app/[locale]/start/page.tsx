import { AuthWrapper } from '@/utils/AuthWrapper';

import { OnboardingFlow } from '@/components/Onboarding';

export default function OnboardingPage() {
  return (
    <AuthWrapper>
      <div>
        <OnboardingFlow />
      </div>
    </AuthWrapper>
  );
}
