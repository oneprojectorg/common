'use client';

import type { Proposal } from '@op/common/client';
import { useEffect, useState } from 'react';

const storageKey = (instanceId: string) => `manual-selection:${instanceId}`;

/**
 * Keeps the admin's pending manual-selection picks in sessionStorage so
 * they survive navigation (e.g. clicking into a proposal detail and
 * hitting browser back). Scoped by instanceId + tab session.
 */
function readInitial(instanceId: string): Proposal[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = sessionStorage.getItem(storageKey(instanceId));
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as Proposal[]) : [];
  } catch {
    return [];
  }
}

export function useManualSelectionDraft(
  instanceId: string,
): [Proposal[], React.Dispatch<React.SetStateAction<Proposal[]>>] {
  const [selected, setSelected] = useState<Proposal[]>(() =>
    readInitial(instanceId),
  );

  useEffect(() => {
    try {
      if (selected.length === 0) {
        sessionStorage.removeItem(storageKey(instanceId));
      } else {
        sessionStorage.setItem(storageKey(instanceId), JSON.stringify(selected));
      }
    } catch {
      /* quota / disabled — ignore */
    }
  }, [instanceId, selected]);

  return [selected, setSelected];
}
