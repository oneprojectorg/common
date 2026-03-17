'use client';

import { useEffect } from 'react';

import PageError, { ErrorProps } from '@/components/screens/PageError';

export default function DecisionError({ error }: ErrorProps) {
  useEffect(() => {
    console.error('[DecisionPage] Error caught by error boundary:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return <PageError error={error} />;
}
