import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { OnboardingFlow } from '@/components/Onboarding';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t('Get Started') };
}

export default function OnboardingPage() {
  return (
    <div className="flex flex-1 flex-col items-center">
      <OnboardingFlow />
    </div>
  );
}
