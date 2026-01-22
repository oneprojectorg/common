'use client';

import { ReactElement, ReactNode, cloneElement } from 'react';
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
      fallbackRender={({ error, resetErrorBoundary }: FallbackProps) => {
        const fallback = fallbacks[error.data?.httpStatus];

        if (fallback) {
          return cloneElement(fallback, { resetErrorBoundary });
        }

        // support a default fallback
        if (fallbacks['default']) {
          return cloneElement(fallbacks['default'], { resetErrorBoundary });
        }

        throw error;
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
};
