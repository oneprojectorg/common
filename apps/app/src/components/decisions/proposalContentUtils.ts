import type { proposalEncoder } from '@op/api/encoders';
import {
  type ProposalTemplateSchema,
  SYSTEM_FIELD_KEYS,
  type XFormat,
  assembleProposalData,
  parseProposalData,
  serverExtensions,
} from '@op/common/client';
import { getTextPreview } from '@op/core';
import { type JSONContent, generateText } from '@tiptap/core';
import type { z } from 'zod';

type Proposal = z.infer<typeof proposalEncoder>;
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

  return (
    getTextPreview({ content: documentContent.content, maxLines: 3 }) ?? ''
  );
}

/**
 * Resolves system field values (title, budget, category) from the pinned
 * TipTap version in `documentContent`, falling back to `proposalData`.
 *
 * `proposalData` in the DB may reflect creation-time values rather than
 * the version that was actually submitted; the document fragments are
 * the source of truth for submitted proposals.
 */
export function resolveProposalSystemFields(proposal: Proposal) {
  const fallback = parseProposalData(proposal.proposalData);

  const template = proposal.proposalTemplate as ProposalTemplateSchema | null;
  if (proposal.documentContent?.type !== 'json' || !template) {
    return fallback;
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

  const resolved = assembleProposalData(template, fragmentTexts);

  return {
    ...fallback,
    ...(resolved.title != null && { title: resolved.title as string }),
    ...(resolved.budget != null && {
      budget: resolved.budget as typeof fallback.budget,
    }),
    ...(resolved.category != null && { category: resolved.category as string }),
  };
}
