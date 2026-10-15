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

const MainPage = async ({
  params,
}: {
  params: Promise<{ locale: string }>;
}) => {
  const { locale } = await params;
  return (
    <Suspense fallback={<LandingScreenSkeleton locale={locale} />}>
      <LandingScreen locale={locale} />
    </Suspense>
  );
};

export default MainPage;
