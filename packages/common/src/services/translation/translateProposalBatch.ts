import type { User } from '@op/supabase/lib';
import type { TranslatableEntry } from '@op/translation';
import { translateBatch } from '@op/translation';
import { DeepLClient } from 'deepl-node';

import { CommonError } from '../../utils';
import { getProposal } from '../decision/getProposal';
import { LOCALE_TO_DEEPL } from './locales';
import type { SupportedLocale } from './locales';

/** Strips HTML tags to produce a plain-text preview. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

const PREVIEW_MAX_LENGTH = 200;

/**
 * Translates proposal card-level content (title, category, preview text) for
 * a batch of proposals in a single DeepL call.
 */
export async function translateProposalBatch({
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
        const plainText = stripHtml(firstHtml).slice(0, PREVIEW_MAX_LENGTH);
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
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    throw new CommonError('DEEPL_API_KEY is not configured');
  }

  const deeplTargetCode = LOCALE_TO_DEEPL[targetLocale];
  const client = new DeepLClient(apiKey);
  const results = await translateBatch({
    entries,
    targetLocale: deeplTargetCode,
    client,
  });

  // 4. Build response grouped by profileId
  const translations: Record<
    string,
    { title?: string; category?: string; preview?: string }
  > = {};
  let sourceLocale = '';

  for (const result of results) {
    // Key format: batch:<profileId>:<field>
    const firstColon = result.contentKey.indexOf(':');
    const lastColon = result.contentKey.lastIndexOf(':');
    const profileId = result.contentKey.slice(firstColon + 1, lastColon);
    const field = result.contentKey.slice(lastColon + 1) as
      | 'title'
      | 'category'
      | 'preview';

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
