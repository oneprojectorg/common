import { normalizeLocation } from '@op/common/client';
import type { LocationData } from '@op/common/client';
import { generateText } from '@tiptap/core';
import type { JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

/**
 * Extracts plain text from TipTap JSON content used in proposal previews.
 */
export function getFragmentText(
  content: JSONContent | null | undefined,
): string {
  if (!content) {
    return '';
  }

  const doc: JSONContent =
    content.type === 'doc' ? content : { type: 'doc', content: [content] };

  try {
    return generateText(doc, [StarterKit]).trim();
  } catch {
    return '';
  }
}

/**
 * Parses preview location content into normalized location data when possible.
 */
export function parsePreviewLocation(
  content: JSONContent | null | undefined,
): LocationData | undefined {
  const raw = getFragmentText(content);

  if (!raw) {
    return undefined;
  }

  try {
    return normalizeLocation(JSON.parse(raw));
  } catch {
    return undefined;
  }
}
