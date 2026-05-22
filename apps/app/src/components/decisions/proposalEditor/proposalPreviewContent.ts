import { normalizeLocation, parseBudgetFragmentValue } from '@op/common/client';
import type { BudgetData, LocationData } from '@op/common/client';
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
 * Parses preview budget content into normalized budget data when possible.
 * Shares `parseBudgetFragmentValue` with the card/detail resolvers so the
 * preview can't accept a budget shape the rendered proposal rejects.
 *
 * `currency` must be the process's configured currency, for the same reason
 * the live editor and the list resolvers take it: a legacy fragment carries a
 * bare amount, and defaulting it to USD makes the version history disagree
 * with every other surface — and makes *restoring* that version persist the
 * wrong currency.
 */
export function parsePreviewBudget(
  content: JSONContent | null | undefined,
  currency?: string,
): BudgetData | undefined {
  return parseBudgetFragmentValue(getFragmentText(content), currency);
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
