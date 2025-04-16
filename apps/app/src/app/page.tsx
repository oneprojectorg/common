'use client';

import { AuthWrapper } from '@/utils/AuthWrapper';

const MainPage = () => {
  return (
    <AuthWrapper>
      <div className="container flex min-h-0 grow flex-col px-0 pt-4">
        Hello world!
      </div>
    </AuthWrapper>
  );
};

export default MainPage;
