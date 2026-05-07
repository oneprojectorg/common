'use client';

import { useLocalStorage } from '@/utils/useLocalStorage';

export function useManualSelectionDraft(instanceId: string) {
  return useLocalStorage<string[]>(`manual-selection:${instanceId}`, []);
}
