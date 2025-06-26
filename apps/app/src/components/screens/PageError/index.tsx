'use client';

import { Button } from '@op/ui/Button';
import { Header2 } from '@op/ui/Header';
import { useEffect } from 'react';

export interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PageError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="absolute left-0 top-0 flex h-screen w-screen flex-col items-center justify-center gap-8">
      <div className="flex flex-col items-center gap-4">
        <Header2 className="font-serif text-[4rem] font-light leading-[110%]">
          500
        </Header2>
        <p className="text-center">
          Something went wrong on our end. We're working to fix it.
          <br />
           Please try again in a moment
        </p>
      </div>
      <Button onPress={reset} color="primary">
        Try again
      </Button>
    </div>
  );
}
