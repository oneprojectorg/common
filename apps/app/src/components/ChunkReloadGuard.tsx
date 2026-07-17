'use client';

import { useEffect } from 'react';

import {
  isChunkLoadError,
  reloadForChunkError,
} from '../lib/chunkErrorRecovery';

// Catches ChunkLoadErrors that escape React error boundaries — a failed dynamic
// import() surfaces as an unhandled promise rejection, and a failed <script>/CSS
// chunk fetch fires a window 'error' event. Both mean the user is on a stale
// build after a deploy, so we recover with a guarded full page reload.
export const ChunkReloadGuard = () => {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error) || isChunkLoadError(event.message)) {
        reloadForChunkError();
      }
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        reloadForChunkError();
      }
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
};
