import { getUser } from '@/utils/getUser';
import type { Metadata } from 'next';

import { getTranslations } from '@/lib/i18n';

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

export default async function OnboardingPage() {
  // Resolve membership server-side so OnboardingFlow branches synchronously.
  const user = await getUser();

  return (
    <div className="flex flex-1 flex-col items-center">
      <OnboardingFlow isNetworkMember={user?.isNetworkMember ?? false} />
    </div>
  );
}
