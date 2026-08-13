import { getTextPreview } from '@op/core';
import type { JSONContent } from '@tiptap/core';

import {
  type ProposalSystemFieldOverrides,
  type ResolvedSystemFields,
  resolveSystemFieldOverrides,
} from './assembleProposalData';
import { getFragmentTextFromTipTapDoc } from './getFragmentTextFromTipTapDoc';
import type { ProposalDocumentContent } from './getProposalDocumentsContent';
import { SYSTEM_FIELD_KEYS } from './getProposalTemplateFieldOrder';
import { resolveBudgetFallbackCurrency } from './templateBudget';
import { tiptapDocToPlainText } from './tiptapDocToPlainText';
import type { ProposalTemplateSchema, XFormat } from './types';

/**
 * Cap on the preview text shipped with list rows — enough for the card's
 * 3-line clamp and the client's language-detection sample (which reads at
 * most 2000 chars), while keeping list payloads small.
 */
export const PROPOSAL_PREVIEW_MAX_LENGTH = 2000;

/** `x-format` values that represent rich-text editor content suitable for preview. */
const TEXT_FORMATS: ReadonlySet<XFormat> = new Set(['short-text', 'long-text']);

/**
 * Single cast point at the TipTap REST boundary: the API types fragment
 * content as `unknown[]`, but it is ProseMirror JSON by contract.
 */
const toTipTapDoc = (content: unknown[]): JSONContent => ({
  type: 'doc',
  content: content as JSONContent[],
});

export interface ProposalListPreview {
  /**
   * Plain-text preview of the document body (`short-text`/`long-text`
   * fragments, legacy `default` fragment, or legacy HTML description).
   * `''` for an empty document, `null` when there is nothing to preview.
   */
  previewText: string | null;
  /**
   * `title`/`budget` resolved from the pinned document fragments — the source
   * of truth for submitted proposals, where `proposalData` may still carry
   * creation-time values. Merged over `proposalData` on list rows so
   * consumers don't need the fragments.
   */
  systemFieldOverrides: ProposalSystemFieldOverrides;
  /**
   * The currency this row's unlabeled money is denominated in, resolved once
   * here and shipped with the row. List payloads carry neither the document
   * fragments nor (on the legacy route) the template, so a client handed only
   * the amount has nothing left to resolve it from.
   */
  budgetCurrency: string;
}

/**
 * Server-side equivalent of the client's `getProposalContentPreview` +
 * `resolveProposalSystemFields` fragment walks. List reads ship this
 * precomputed preview instead of the full document fragments.
 */
export function buildProposalListPreview({
  documentContent,
  proposalTemplate,
  storedProposalData,
}: {
  documentContent: ProposalDocumentContent | undefined;
  proposalTemplate: ProposalTemplateSchema | null;
  /**
   * The row's raw `proposalData` JSON. Only its budget's currency is read, and
   * only for a fragment that names none — see
   * {@link resolveBudgetFallbackCurrency}. Pass the raw row rather than a
   * parsed one: parsing drops a budget whose shape `budgetValueSchema` can't
   * read, and the stored currency goes with it.
   */
  storedProposalData?: unknown;
}): ProposalListPreview {
  const budgetCurrency = resolveBudgetFallbackCurrency(
    storedProposalData,
    proposalTemplate,
  );

  if (!documentContent || documentContent.type === 'unavailable') {
    return { previewText: null, systemFieldOverrides: {}, budgetCurrency };
  }

  if (documentContent.type === 'html') {
    return {
      previewText: getTextPreview({
        content: documentContent.content,
        maxLines: 20,
        maxLength: PROPOSAL_PREVIEW_MAX_LENGTH,
      }),
      systemFieldOverrides: {},
      budgetCurrency,
    };
  }

  const { fragments } = documentContent;

  // Preview body: every non-system fragment whose `x-format` is a text
  // format (fields without a template entry are included for legacy docs).
  const textContent: unknown[] = [];
  for (const [key, fragment] of Object.entries(fragments)) {
    if (SYSTEM_FIELD_KEYS.has(key) || !fragment?.content) {
      continue;
    }

    const format = proposalTemplate?.properties?.[key]?.['x-format'];
    if (format && !TEXT_FORMATS.has(format)) {
      continue;
    }

    textContent.push(...fragment.content);
  }

  // Fall back to the legacy single `default` fragment.
  if (textContent.length === 0 && fragments.default?.content) {
    textContent.push(...fragments.default.content);
  }

  // Empty doc (e.g. unedited draft) — preview nothing, not an error. A
  // malformed fragment must not break the whole list (same try/catch parity
  // as the client walk this replaces, getProposalContentPreview).
  let previewText: string | null;
  if (textContent.length === 0) {
    previewText = '';
  } else {
    try {
      previewText =
        tiptapDocToPlainText(toTipTapDoc(textContent))
          .trim()
          .slice(0, PROPOSAL_PREVIEW_MAX_LENGTH) || null;
    } catch {
      previewText = null;
    }
  }

  let resolved: ResolvedSystemFields = { overrides: {}, budgetCurrency };
  if (proposalTemplate) {
    const fragmentTexts: Record<string, string> = {};
    for (const key of SYSTEM_FIELD_KEYS) {
      const content = fragments[key]?.content;
      if (!content?.length) {
        continue;
      }

      try {
        const text = getFragmentTextFromTipTapDoc(toTipTapDoc(content)).trim();
        if (text) {
          fragmentTexts[key] = text;
        }
      } catch {
        // Skip malformed fragments — same as the client-side walk.
      }
    }

    // Shared with the client's `resolveProposalSystemFields`, so a proposal
    // never renders one budget on a list card and another on its detail page —
    // including the currency it renders in, which comes back resolved.
    resolved = resolveSystemFieldOverrides(fragmentTexts, budgetCurrency);
  }

  return {
    previewText,
    systemFieldOverrides: resolved.overrides,
    budgetCurrency: resolved.budgetCurrency,
  };
}
