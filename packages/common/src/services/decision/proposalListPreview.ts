import type { TipTapFragmentResponse } from '@op/collab';
import { getTextPreview } from '@op/core';
import type { JSONContent } from '@tiptap/core';

import { assembleProposalData } from './assembleProposalData';
import { getFragmentTextFromTipTapDoc } from './getFragmentTextFromTipTapDoc';
import type { ProposalDocumentContent } from './getProposalDocumentsContent';
import { SYSTEM_FIELD_KEYS } from './getProposalTemplateFieldOrder';
import { type BudgetData, normalizeBudget } from './proposalDataSchema';
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

/**
 * Resolves `keys` to values from the live document, falling back to nothing
 * when a key's fragment is absent, empty, or malformed — the shared
 * fragment-to-value walk behind both the list preview's `title`/`budget`
 * override and the CSV export's `budget`/`category`/`location` override.
 * `proposalData` is a creation-time snapshot that goes stale once a field is
 * edited in the collab doc after submission; this recovers the authoritative
 * value from the document instead.
 */
export function resolveDocumentFieldValues({
  fragments,
  proposalTemplate,
  keys,
}: {
  fragments: TipTapFragmentResponse;
  proposalTemplate: ProposalTemplateSchema | null;
  keys: Iterable<string>;
}): Record<string, unknown> {
  if (!proposalTemplate) {
    return {};
  }

  const fragmentTexts: Record<string, string> = {};
  for (const key of keys) {
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

  return assembleProposalData(proposalTemplate, fragmentTexts);
}

/**
 * `assembleProposalData`'s legacy `type: 'number'` budget branch
 * (`extractBudgetValue`) resolves to a bare number, which never carries a
 * currency — normalizing it through the canonical shape would default to
 * `'USD'` and silently overwrite a real non-USD value a legacy schema was
 * never able to express, so a bare-number override keeps `existing`'s
 * currency instead. That same branch also returns `0` both for a
 * genuinely-zero budget and for a fragment that failed to parse into a real
 * amount — indistinguishable here, so `0` is treated as unresolved rather
 * than risk zeroing out a real budget.
 *
 * Known residual gap, accepted rather than chased further: a *canonical*
 * money field (`schema.type !== 'number'`) whose fragment text happens to be
 * a bare JSON number hits `assembleProposalData`'s `normalizeBudget(parsed)`
 * branch before this function ever sees it, which applies the identical
 * legacy-number-to-USD coercion and hands us an already-built object — so
 * `typeof raw === 'number'` never fires and the currency/zero guards don't
 * apply. No known write path produces this (a canonical field's fragment is
 * always the `{ amount, currency }` shape), and the coercion itself lives in
 * the widely-shared `normalizeBudget`/`budgetValueSchema` — also used to
 * parse the snapshot itself — so fixing it here without fixing it there
 * would just relocate the inconsistency.
 */
export function resolveBudgetOverride(
  raw: unknown,
  existing: BudgetData | null | undefined,
): BudgetData | undefined {
  if (typeof raw === 'number') {
    return raw === 0
      ? (existing ?? undefined)
      : { amount: raw, currency: existing?.currency ?? 'USD' };
  }
  return normalizeBudget(raw) ?? existing ?? undefined;
}

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
  systemFieldOverrides: { title?: string; budget?: BudgetData };
}

/**
 * The proposal's document body as a single TipTap doc: every non-system
 * fragment whose `x-format` is a text format, in fragment order, falling back
 * to the legacy single `default` fragment. `null` when there is no body text.
 *
 * Fragments are keyed by template field name — `summary` for the current
 * templates, `default` only for legacy untemplated documents — so a reader
 * that hardcodes one key returns nothing for every proposal on a template
 * while continuing to work for the legacy ones. Shared with the CSV export,
 * which needs the same selection but the full text rather than a capped
 * preview.
 */
export function collectProposalBodyDoc({
  fragments,
  proposalTemplate,
}: {
  fragments: TipTapFragmentResponse;
  proposalTemplate: ProposalTemplateSchema | null;
}): JSONContent | null {
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

  if (textContent.length === 0 && fragments.default?.content) {
    textContent.push(...fragments.default.content);
  }

  return textContent.length > 0 ? toTipTapDoc(textContent) : null;
}

/**
 * Server-side equivalent of the client's `getProposalContentPreview` +
 * `resolveProposalSystemFields` fragment walks. List reads ship this
 * precomputed preview instead of the full document fragments.
 */
export function buildProposalListPreview({
  documentContent,
  proposalTemplate,
  existingBudget,
}: {
  documentContent: ProposalDocumentContent | undefined;
  proposalTemplate: ProposalTemplateSchema | null;
  /**
   * The pre-merge snapshot budget, so a resolved override can preserve its
   * currency — omit only when the caller has no snapshot to preserve from.
   */
  existingBudget?: BudgetData | null;
}): ProposalListPreview {
  if (!documentContent || documentContent.type === 'unavailable') {
    return { previewText: null, systemFieldOverrides: {} };
  }

  if (documentContent.type === 'html') {
    return {
      previewText: getTextPreview({
        content: documentContent.content,
        maxLines: 20,
        maxLength: PROPOSAL_PREVIEW_MAX_LENGTH,
      }),
      systemFieldOverrides: {},
    };
  }

  const { fragments } = documentContent;

  const bodyDoc = collectProposalBodyDoc({ fragments, proposalTemplate });

  // Empty doc (e.g. unedited draft) — preview nothing, not an error. A
  // malformed fragment must not break the whole list (same try/catch parity
  // as the client walk this replaces, getProposalContentPreview).
  let previewText: string | null;
  if (!bodyDoc) {
    previewText = '';
  } else {
    try {
      previewText =
        tiptapDocToPlainText(bodyDoc)
          .trim()
          .slice(0, PROPOSAL_PREVIEW_MAX_LENGTH) || null;
    } catch {
      previewText = null;
    }
  }

  const resolved = resolveDocumentFieldValues({
    fragments,
    proposalTemplate,
    keys: SYSTEM_FIELD_KEYS,
  });

  const systemFieldOverrides: ProposalListPreview['systemFieldOverrides'] = {};
  if (typeof resolved.title === 'string') {
    systemFieldOverrides.title = resolved.title;
  }

  const budget = resolveBudgetOverride(resolved.budget, existingBudget);
  if (budget) {
    systemFieldOverrides.budget = budget;
  }

  return { previewText, systemFieldOverrides };
}
