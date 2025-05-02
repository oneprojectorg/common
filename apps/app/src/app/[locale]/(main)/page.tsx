'use client';

import { AuthWrapper } from '@/utils/AuthWrapper';
import { Suspense } from 'react';

import {
  LandingScreen,
  LandingScreenSkeleton,
} from '@/components/screens/LandingScreen';

const MainPage = () => {
  return (
    <AuthWrapper>
      <Suspense fallback={<LandingScreenSkeleton />}>
        <LandingScreen />
      </Suspense>
    </AuthWrapper>
  );
};

export default MainPage;
