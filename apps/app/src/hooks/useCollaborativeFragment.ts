'use client';

import { readFragmentText, writeFragmentText } from '@op/collab/fragmentText';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Doc } from 'yjs';

/**
 * Syncs a plain-text value with a Y.XmlFragment.
 * Values are stored inside a paragraph `Y.XmlElement` so that TipTap
 * Cloud serialises them as valid ProseMirror JSON, avoiding the
 * double-nested array artefact that bare `Y.XmlText` nodes produce.
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
    const existing = readFragmentText(fragment);
    if (existing) {
      setValue(existing);
    }

    // Observe remote changes
    const observer = () => {
      if (isLocalUpdateRef.current) {
        isLocalUpdateRef.current = false;
        return;
      }
      setValue(readFragmentText(fragment));
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
        writeFragmentText({ fragment, text: newValue });
      });
    },
    [ydoc, fragmentName],
  );

  return [value, setFragmentValue];
}
