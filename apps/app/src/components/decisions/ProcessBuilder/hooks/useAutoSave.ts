import { useDebounce } from '@op/hooks';
import { useEffect, useRef } from 'react';

import type { SaveStatus } from '../stores/useProcessBuilderStore';

const DEFAULT_DEBOUNCE_MS = 1000;

/**
 * Hook for auto-saving data with debouncing and change detection.
 *
 * @example
 * ```tsx
 * useAutoSave({
 *   data: phases,
 *   onSave: async (data) => {
 *     await updateInstance.mutateAsync({ phases: data });
 *   },
 *   setSaveStatus: (status) => setSaveStatus(decisionProfileId, status),
 *   markSaved: () => markSaved(decisionProfileId),
 * });
 * ```
 */
export function useAutoSave<T>({
  data,
  onSave,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  setSaveStatus,
  markSaved,
}: {
  /** The data to auto-save */
  data: T;
  /** Async function called when data changes (after debounce) */
  onSave: (data: T) => Promise<void>;
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

    // Trigger save
    setSaveStatus('saving');
    onSave(debouncedData)
      .then(() => markSaved())
      .catch(() => setSaveStatus('error'));
  }, [debouncedData, onSave, setSaveStatus, markSaved]);
}
