import { useDebounce } from '@op/hooks';
import { useEffect, useRef, useState } from 'react';

import type { SaveStatus } from '../stores/useProcessBuilderStore';

const DEFAULT_DEBOUNCE_MS = 1000;

/**
 * Hook for auto-saving data with debouncing and change detection.
 *
 * Supports two modes:
 * - **Draft mode** (`enabled: true`): Saves to both localStorage and API
 * - **Published mode** (`enabled: false`): Saves to localStorage only, tracks pending changes
 *
 * @example
 * ```tsx
 * const { hasPendingChanges, publishChanges } = useAutoSave({
 *   data: phases,
 *   enabled: instance.status === 'draft',
 *   onLocalSave: (data) => {
 *     setPhaseData(decisionProfileId, data);
 *   },
 *   onApiSave: async (data) => {
 *     await updateInstance.mutateAsync({ phases: data });
 *   },
 *   setSaveStatus: (status) => setSaveStatus(decisionProfileId, status),
 *   markSaved: () => markSaved(decisionProfileId),
 * });
 * ```
 */
export function useAutoSave<T>({
  data,
  enabled = true,
  onLocalSave,
  onApiSave,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  setSaveStatus,
  markSaved,
}: {
  /** The data to auto-save */
  data: T;
  /** Whether to auto-save to API (defaults to true). When false, only saves to localStorage. */
  enabled?: boolean;
  /** Sync function called to save data to localStorage (always runs) */
  onLocalSave: (data: T) => void;
  /** Async function called to save data to API (only when enabled) */
  onApiSave: (data: T) => Promise<void>;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Callback to update save status indicator */
  setSaveStatus: (status: SaveStatus) => void;
  /** Callback to mark save as complete with timestamp */
  markSaved: () => void;
}) {
  const [debouncedData] = useDebounce(data, debounceMs);
  const isInitialMount = useRef(true);
  const previousData = useRef<string | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const pendingDataRef = useRef<T | null>(null);

  useEffect(() => {
    const dataString = JSON.stringify(debouncedData);

    // Skip initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      previousData.current = dataString;
      return;
    }

    // Skip if data hasn't changed
    if (dataString === previousData.current) {
      return;
    }
    previousData.current = dataString;

    // Always save to localStorage
    onLocalSave(debouncedData);

    if (enabled) {
      // Draft mode: save to API
      setSaveStatus('saving');
      onApiSave(debouncedData)
        .then(() => {
          markSaved();
          setHasPendingChanges(false);
          pendingDataRef.current = null;
        })
        .catch(() => setSaveStatus('error'));
    } else {
      // Published mode: track pending changes
      setHasPendingChanges(true);
      pendingDataRef.current = debouncedData;
      setSaveStatus('idle');
    }
  }, [
    debouncedData,
    enabled,
    onLocalSave,
    onApiSave,
    setSaveStatus,
    markSaved,
  ]);

  /** Manually publish pending changes to the API */
  const publishChanges = async () => {
    if (!hasPendingChanges || !pendingDataRef.current) {
      return;
    }

    setSaveStatus('saving');
    try {
      await onApiSave(pendingDataRef.current);
      markSaved();
      setHasPendingChanges(false);
      pendingDataRef.current = null;
    } catch {
      setSaveStatus('error');
    }
  };

  return {
    /** Whether there are unpublished changes (only relevant when enabled=false) */
    hasPendingChanges,
    /** Manually trigger API save for pending changes */
    publishChanges,
  };
}
