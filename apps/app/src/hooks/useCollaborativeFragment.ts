'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import type { Doc } from 'yjs';

/**
 * Syncs a plain-text value with a Y.XmlFragment.
 * This ensures all collaborative data is stored as XmlFragment,
 * making it accessible via the TipTap Cloud REST API.
 *
 * @param ydoc - The shared Yjs document
 * @param fragmentName - The fragment key (e.g. 'category', 'budget')
 * @param initialValue - Fallback before Yjs syncs
 */
export function useCollaborativeFragment(
  ydoc: Doc | null,
  fragmentName: string,
  initialValue: string,
): [string, (value: string) => void] {
  const [value, setValue] = useState(initialValue);
  const isLocalUpdateRef = useRef(false);

  useEffect(() => {
    if (!ydoc) {
      return;
    }

    const fragment = ydoc.getXmlFragment(fragmentName);

    // Read existing value
    const existing = fragment.toString();
    if (existing) {
      setValue(existing);
    }

    // Observe remote changes
    const observer = () => {
      if (isLocalUpdateRef.current) {
        isLocalUpdateRef.current = false;
        return;
      }
      setValue(fragment.toString());
    };

    fragment.observeDeep(observer);
    return () => fragment.unobserveDeep(observer);
  }, [ydoc, fragmentName]);

  const setFragmentValue = useCallback(
    (newValue: string) => {
      setValue(newValue);
      if (!ydoc) {
        return;
      }

      const fragment = ydoc.getXmlFragment(fragmentName);
      isLocalUpdateRef.current = true;

      ydoc.transact(() => {
        fragment.delete(0, fragment.length);
        if (newValue) {
          fragment.insert(0, [new Y.XmlText(newValue)]);
        }
      });
    },
    [ydoc, fragmentName],
  );

  return [value, setFragmentValue];
}
