import { getTextPreview } from '@op/core';
import type { User } from '@op/supabase/lib';
import type { TranslatableEntry } from '@op/translation';

import { getProposal } from '../decision/getProposal';
import type { SupportedLocale } from './locales';
import { runTranslateBatch } from './runTranslateBatch';

/**
 * Translates proposal card-level content (title, category, preview text) for
 * a batch of proposals in a single DeepL call.
 */
export async function translateProposals({
  profileIds,
  targetLocale,
  user,
}: {
  profileIds: string[];
  targetLocale: SupportedLocale;
  user: User;
}): Promise<{
  translations: Record<
    string,
    { title?: string; category?: string; preview?: string }
  >;
  sourceLocale: string;
  targetLocale: SupportedLocale;
}> {
  // 1. Fetch all proposals in parallel
  const proposals = await Promise.all(
    profileIds.map((profileId) => getProposal({ profileId, user })),
  );

  // 2. Build translatable entries for all proposals
  const entries: TranslatableEntry[] = [];

  for (const proposal of proposals) {
    const { proposalData } = proposal;
    const pid = proposal.profileId;

    if (proposalData.title) {
      entries.push({
        contentKey: `batch:${pid}:title`,
        text: proposalData.title,
      });
    }

    if (proposalData.category) {
      entries.push({
        contentKey: `batch:${pid}:category`,
        text: proposalData.category,
      });
    }

    // Extract plain-text preview from the first non-empty HTML fragment
    if (proposal.htmlContent) {
      const htmlContent = proposal.htmlContent as Record<string, string>;
      const firstHtml = Object.values(htmlContent).find(Boolean);
      if (firstHtml) {
        const plainText = getTextPreview({
          content: firstHtml,
          maxLines: 3,
          maxLength: 200,
        });
        if (plainText) {
          entries.push({
            contentKey: `batch:${pid}:preview`,
            text: plainText,
          });
        }
      }
    }
  }

  if (entries.length === 0) {
    return { translations: {}, sourceLocale: '', targetLocale };
  }

  // 3. Translate via DeepL with cache-through
  const results = await runTranslateBatch(entries, targetLocale);

  // 4. Build response grouped by profileId
  const translations: Record<
    string,
    { title?: string; category?: string; preview?: string }
  > = {};
  let sourceLocale = '';

  for (const result of results) {
    // Key format: batch:<profileId>:<field>
    const parts = result.contentKey.split(':');
    if (parts.length < 3 || parts[0] !== 'batch') {
      continue;
    }
    const field = parts[parts.length - 1] as 'title' | 'category' | 'preview';
    const profileId = parts.slice(1, -1).join(':');

    if (!translations[profileId]) {
      translations[profileId] = {};
    }
    translations[profileId][field] = result.translatedText;

    if (!sourceLocale && result.sourceLocale) {
      sourceLocale = result.sourceLocale;
    }
  }

  return { translations, sourceLocale, targetLocale };
}
