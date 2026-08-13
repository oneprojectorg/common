import {
  type Proposal,
  type ProposalTemplateSchema,
  SYSTEM_FIELD_KEYS,
  type XFormat,
  parseProposalData,
  resolveBudgetFallbackCurrency,
  resolveSystemFieldOverrides,
  serverExtensions,
} from '@op/common/client';
import { getTextPreview } from '@op/core';
import { type JSONContent, generateText } from '@tiptap/core';

type DocumentContent = NonNullable<Proposal['documentContent']>;

/** `x-format` values that represent rich-text editor content suitable for preview. */
const TEXT_FORMATS = new Set<XFormat>(['short-text', 'long-text']);

/**
 * Extracts a plain-text preview from proposal document content.
 *
 * Uses the proposal template's `x-format` to determine which fragments
 * contain text content. System fields (title, budget, category) and
 * scalar-value fields (dropdown, money) are excluded — only `short-text`
 * and `long-text` fragments are included in the preview.
 *
 * @param documentContent - The document content from the proposal
 * @param proposalTemplate - The proposal template schema (carries `x-format` per field)
 */
export function getProposalContentPreview(
  documentContent: DocumentContent | undefined,
  proposalTemplate: ProposalTemplateSchema | undefined,
): string | null {
  if (!documentContent) {
    return null;
  }

  if (documentContent.type === 'json') {
    const { fragments } = documentContent;
    const allContent: unknown[] = [];

    for (const [key, fragment] of Object.entries(fragments)) {
      if (SYSTEM_FIELD_KEYS.has(key) || !fragment?.content) {
        continue;
      }

      // Only include text fields in the preview. Scalar value fields
      // (dropdown, money) are rendered by their own card components.
      const format = proposalTemplate?.properties?.[key]?.['x-format'];
      if (format && !TEXT_FORMATS.has(format)) {
        continue;
      }

      allContent.push(...fragment.content);
    }

    // Fall back to legacy `default` fragment
    if (allContent.length === 0) {
      const defaultFragment = fragments.default;
      if (defaultFragment?.content) {
        allContent.push(...defaultFragment.content);
      }
    }

    if (allContent.length === 0) {
      // Empty doc (e.g. unedited draft) — render nothing, not an error.
      return '';
    }

    const content = { type: 'doc', content: allContent } as JSONContent;

    try {
      const text = generateText(content, serverExtensions);
      return text.trim() || null;
    } catch {
      return null;
    }
  }

  if (documentContent.type === 'html') {
    return (
      getTextPreview({ content: documentContent.content, maxLines: 3 }) ?? ''
    );
  }

  // type === 'unavailable' — no text to preview.
  return null;
}

/**
 * Resolves system field values (title, budget, category) from the pinned
 * TipTap version in `documentContent`, falling back to `proposalData`.
 *
 * `proposalData` in the DB may reflect creation-time values rather than
 * the version that was actually submitted; the document fragments are
 * the source of truth for submitted proposals.
 *
 * Also returns `budgetCurrency` — the currency this proposal's unlabeled money
 * is denominated in. Callers rendering money that is *not* the requested
 * budget (an allocated amount, say) should use it rather than reading
 * `budget.currency`, which is absent for a proposal that never named one.
 */
export function resolveProposalSystemFields(proposal: Proposal) {
  const fallback = parseProposalData(proposal.proposalData);

  const template = proposal.proposalTemplate as ProposalTemplateSchema | null;
  // Server-resolved wherever the row carries it, which is every route that
  // renders a budget: list payloads ship the code instead of the template it
  // was resolved from, and `getProposal` ships it because only the server sees
  // the raw row. That last one matters — the client is served *parsed* data,
  // and a budget whose amount `budgetValueSchema` can't read is dropped whole,
  // taking the currency stored beside it. Resolving from parsed data would
  // then miss the row's tier and fall through to the template's, rendering a
  // proposal's editor in one currency and its list card in another.
  //
  // The local resolve is the floor under routes that ship neither — it reads
  // the same tiers in the same order, and agrees wherever the parse was
  // lossless, which is every budget storage actually holds today.
  const fallbackCurrency =
    proposal.budgetCurrency ??
    resolveBudgetFallbackCurrency(proposal.proposalData, template);

  if (proposal.documentContent?.type !== 'json' || !template) {
    return { ...fallback, budgetCurrency: fallbackCurrency };
  }

  const { fragments } = proposal.documentContent;
  const fragmentTexts: Record<string, string> = {};

  for (const key of SYSTEM_FIELD_KEYS) {
    const content = fragments[key]?.content;
    if (!content?.length) {
      continue;
    }

    try {
      const text = generateText(
        { type: 'doc', content: content as JSONContent[] },
        serverExtensions,
      ).trim();
      if (text) {
        fragmentTexts[key] = text;
      }
    } catch {
      // skip malformed fragments
    }
  }

  const { overrides, budgetCurrency } = resolveSystemFieldOverrides(
    fragmentTexts,
    fallbackCurrency,
  );

  return { ...fallback, ...overrides, budgetCurrency };
}
