/**
 * Utilities for detecting and handling connection errors in tRPC mutations
 */
import React from 'react';

export interface ConnectionErrorInfo {
  isConnectionError: boolean;
  message: string;
  shouldRetry: boolean;
  retryDelay?: number;
}

/**
 * Detects if an error is connection-related rather than a validation or server error
 */
export const isConnectionError = (error: any): boolean => {
  if (!error) return false;

  // Check error name/type
  if (error.name === 'AuthRetryableFetchError') return true;
  if (error.code === 'NETWORK_ERROR') return true;
  if (error.code === 'FETCH_ERROR') return true;

  // Check error message content
  const message = error.message?.toLowerCase() || '';
  return (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('unable to connect')
  );
};

/**
 * Analyzes an error and provides structured information for handling
 */
export const analyzeError = (error: any): ConnectionErrorInfo => {
  const isConn = isConnectionError(error);

  if (isConn) {
    return {
      isConnectionError: true,
      message:
        'Connection issue. Please check your internet connection and try again.',
      shouldRetry: true,
      retryDelay: 2000,
    };
  }

  // Server/validation errors
  return {
    isConnectionError: false,
    message: error?.message || 'Something went wrong. Please try again.',
    shouldRetry: false,
  };
};

/**
 * Creates retry delay with exponential backoff
 */
export const getRetryDelay = (attempt: number, baseDelay = 1000): number => {
  return Math.min(baseDelay * Math.pow(2, attempt - 1), 30000);
};

/**
 * Hook for connection status monitoring
 */
export const useConnectionStatus = () => {
  const [isOnline, setIsOnline] = React.useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};
