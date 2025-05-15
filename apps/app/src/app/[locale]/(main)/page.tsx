'use client';

import { Suspense } from 'react';

import {
  LandingScreen,
  LandingScreenSkeleton,
} from '@/components/screens/LandingScreen';

const MainPage = () => {
  return (
    <Suspense fallback={<LandingScreenSkeleton />}>
      <LandingScreen />
    </Suspense>
  );
};

export default MainPage;
