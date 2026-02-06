'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Doc } from 'yjs';

/**
 * Syncs a scalar value bidirectionally with a Yjs shared Map.
 *
 * Uses the Y.Doc's "fields" Y.Map to store key-value pairs that sync
 * across all connected clients. This is the scalar-value equivalent of
 * TipTap's Collaboration extension (which uses Y.XmlFragment for rich text).
 *
 * @param ydoc - The shared Yjs document
 * @param field - The key within the "fields" Y.Map
 * @param initialValue - Value to use before Yjs syncs (NOT written to Yjs)
 */
export function useCollaborativeField<T>(
  ydoc: Doc | null,
  field: string,
  initialValue: T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(initialValue);
  const isLocalUpdateRef = useRef(false);

  // Observe remote changes from Yjs
  useEffect(() => {
    if (!ydoc) {
      return;
    }

    const ymap = ydoc.getMap('fields');

    // Initialize from existing Yjs state if present
    const existing = ymap.get(field);
    if (existing !== undefined) {
      setValue(existing as T);
    }

    const observer = () => {
      if (isLocalUpdateRef.current) {
        isLocalUpdateRef.current = false;
        return;
      }
      const remote = ymap.get(field);
      if (remote !== undefined) {
        setValue(remote as T);
      }
    };

    ymap.observe(observer);
    return () => {
      ymap.unobserve(observer);
    };
  }, [ydoc, field]);

  // Write local changes to Yjs
  const setCollaborativeValue = useCallback(
    (newValue: T) => {
      setValue(newValue);
      if (!ydoc) {
        return;
      }
      const ymap = ydoc.getMap('fields');
      isLocalUpdateRef.current = true;
      ymap.set(field, newValue as unknown);
    },
    [ydoc, field],
  );

  return [value, setCollaborativeValue];
}
