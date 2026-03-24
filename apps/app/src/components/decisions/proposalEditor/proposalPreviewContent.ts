import { normalizeBudget } from '@op/common/client';
import type { BudgetData } from '@op/common/client';
import type { JSONContent } from '@tiptap/react';

/**
 * Extracts plain text from TipTap JSON content used in proposal previews.
 */
export function extractPreviewText(
  content: JSONContent | null | undefined,
): string {
  if (!content) {
    return '';
  }

  if (typeof content.text === 'string') {
    return content.text;
  }

  if (!Array.isArray(content.content)) {
    return '';
  }

  return content.content.map((child) => extractPreviewText(child)).join('');
}

/**
 * Parses preview budget content into normalized budget data when possible.
 */
export function parsePreviewBudget(
  content: JSONContent | null | undefined,
): BudgetData | undefined {
  const raw = extractPreviewText(content);

  if (!raw) {
    return undefined;
  }

  try {
    return normalizeBudget(JSON.parse(raw));
  } catch {
    return normalizeBudget(raw);
  }
}
