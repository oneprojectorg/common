import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

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

const MainPage = ({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) => {
  return (
    <Suspense fallback={<LandingScreenSkeleton />}>
      {/* Not awaited here: the promise is forwarded so only the welcome
          headline suspends on it, behind its own boundary. */}
      <LandingScreen searchParams={searchParams} />
    </Suspense>
  );
};

export default MainPage;
