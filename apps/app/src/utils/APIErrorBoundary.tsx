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
        const fallback = fallbacks[error.data?.httpStatus];

        if (fallback) {
          return fallback;
        }

        // support a default fallback
        if (fallbacks['default']) {
          return fallbacks['default'];
        }

        throw error;
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
};
