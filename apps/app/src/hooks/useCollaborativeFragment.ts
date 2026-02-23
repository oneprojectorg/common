'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import type { Doc } from 'yjs';

/**
 * Extracts the plain-text content from a Y.XmlFragment containing a
 * paragraph-wrapped `Y.XmlElement` node (as written by `setFragmentValue`).
 */
function getFragmentText(fragment: Y.XmlFragment): string {
  const parts: string[] = [];
  fragment.forEach((node) => {
    if (node instanceof Y.XmlElement) {
      node.forEach((child) => {
        if (child instanceof Y.XmlText) {
          parts.push(child.toJSON());
        }
      });
    }
  });
  return parts.join('');
}

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
    const existing = getFragmentText(fragment);
    if (existing) {
      setValue(existing);
    }

    // Observe remote changes
    const observer = () => {
      if (isLocalUpdateRef.current) {
        isLocalUpdateRef.current = false;
        return;
      }
      setValue(getFragmentText(fragment));
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
          const paragraph = new Y.XmlElement('paragraph');
          paragraph.insert(0, [new Y.XmlText(newValue)]);
          fragment.insert(0, [paragraph]);
        }
      });
    },
    [ydoc, fragmentName],
  );

  return [value, setFragmentValue];
}
