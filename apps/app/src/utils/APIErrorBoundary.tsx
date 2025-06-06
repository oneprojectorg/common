'use client';

import { ReactElement, ReactNode } from 'react';
import {
  FallbackProps,
  ErrorBoundary as ReactErrorBoundary,
} from 'react-error-boundary';

type APIFallbacks = {
  [code: string]: ReactElement<FallbackProps> | null;
};

export const APIErrorBoundary = ({
  children,
  fallbacks = {},
}: {
  children: ReactNode;
  fallbacks?: APIFallbacks;
}) => {
  return (
    <ReactErrorBoundary
      fallbackRender={({ error }: FallbackProps) => {
        const fallback = fallbacks[error.status];

        if (fallback) {
          return fallback;
        }

        throw error;
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
};
