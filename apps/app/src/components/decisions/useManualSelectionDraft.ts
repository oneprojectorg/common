'use client';

import { useLocalStorage } from '@/utils/useLocalStorage';
import type { Proposal } from '@op/common/client';

/**
 * Keeps the admin's pending manual-selection picks in localStorage so
 * they survive navigation (e.g. clicking into a proposal detail and
 * hitting browser back). Scoped by instanceId.
 *
 * Stores full Proposal objects rather than ids so selections remain
 * correct when the current filter/sort excludes a previously selected
 * proposal — the confirm dialog and footer count would otherwise drop it.
 */
export function useManualSelectionDraft(instanceId: string) {
  return useLocalStorage<Proposal[]>(`manual-selection:${instanceId}`, []);
}
