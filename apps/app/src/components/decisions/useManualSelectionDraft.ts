'use client';

import type { Proposal } from '@op/common/client';

import { useSessionStorage } from '@/utils/useSessionStorage';

/**
 * Keeps the admin's pending manual-selection picks in sessionStorage so
 * they survive navigation (e.g. clicking into a proposal detail and
 * hitting browser back). Scoped by instanceId + tab session.
 *
 * Stores full Proposal objects rather than ids so selections remain
 * correct when the current filter/sort excludes a previously selected
 * proposal — the confirm dialog and footer count would otherwise drop it.
 */
export function useManualSelectionDraft(instanceId: string) {
  const [stored, setStored] = useSessionStorage<Proposal[]>(
    `manual-selection:${instanceId}`,
    [],
  );

  const selected = stored.filter(
    (p): p is Proposal => typeof p?.id === 'string',
  );

  return [selected, setStored] as const;
}
