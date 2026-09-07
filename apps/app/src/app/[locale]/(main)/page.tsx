import type { Metadata } from 'next';
import { Suspense } from 'react';

import { getTranslations } from '@/lib/i18n';

import {
  LandingScreen,
  LandingScreenSkeleton,
} from '@/components/screens/LandingScreen';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t('Home') };
}

const MainPage = () => {
  return (
    <Suspense fallback={<LandingScreenSkeleton />}>
      <LandingScreen />
    </Suspense>
  );
};

export default MainPage;
