'use client';

import { ReactNode } from 'react';
import {
  FallbackProps,
  ErrorBoundary as ReactErrorBoundary,
} from 'react-error-boundary';

type APIFallbacks = {
  [code: string]: ((props: FallbackProps) => ReactNode) | null;
};

export const APIErrorBoundary = ({
  children,
  fallbacks = {},
  resetKeys,
}: {
  children: ReactNode;
  fallbacks?: APIFallbacks;
  resetKeys?: unknown[];
}) => {
  return (
    <ReactErrorBoundary
      resetKeys={resetKeys}
      fallbackRender={({ error, resetErrorBoundary }: FallbackProps) => {
        const fallback = fallbacks[error.data?.httpStatus];

        if (fallback) {
          return fallback({ error, resetErrorBoundary });
        }

        // support a default fallback
        if (fallbacks['default']) {
          return fallbacks['default']({ error, resetErrorBoundary });
        }

        throw error;
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
};
