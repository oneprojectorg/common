import type { User } from '@op/supabase/lib';
import type { TranslatableEntry } from '@op/translation';
import { translateBatch } from '@op/translation';
import { DeepLClient } from 'deepl-node';

import { CommonError } from '../../utils';
import { getProposal } from '../decision/getProposal';
import { LOCALE_TO_DEEPL } from './locales';
import type { SupportedLocale } from './locales';

/**
 * Translates a proposal's content (title, category, HTML fragments) into the
 * target locale via DeepL with cache-through semantics.
 */
export async function translateProposal({
  profileId,
  targetLocale,
  user,
}: {
  profileId: string;
  targetLocale: SupportedLocale;
  user: User;
}): Promise<{
  translated: Record<string, string>;
  sourceLocale: string;
  targetLocale: SupportedLocale;
}> {
  // 1. Fetch proposal (includes proposalData with title, category, etc.)
  const proposal = await getProposal({ profileId, user });

  // 2. Build translatable entries
  const entries: TranslatableEntry[] = [];
  const proposalId = proposal.id;
  const { proposalData } = proposal;

  // TODO: eventually use `htmlContent` for all fields
  if (proposalData.title) {
    entries.push({
      contentKey: `proposal:${proposalId}:title`,
      text: proposalData.title,
    });
  }

  if (proposalData.category) {
    entries.push({
      contentKey: `proposal:${proposalId}:category`,
      text: proposalData.category,
    });
  }

  // HTML fragments from TipTap — proposal.htmlContent is the server-generated HTML (Record<string, string>)
  if (proposal.htmlContent) {
    const htmlContent = proposal.htmlContent as Record<string, string>;
    for (const [fragmentName, html] of Object.entries(htmlContent)) {
      if (html) {
        entries.push({
          contentKey: `proposal:${proposalId}:${fragmentName}`,
          text: html,
        });
      }
    }
  }

  if (entries.length === 0) {
    return { translated: {}, sourceLocale: '', targetLocale };
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

  // 4. Build response — strip the "proposal:<id>:" prefix to get the field name back
  const prefix = `proposal:${proposalId}:`;
  const translated: Record<string, string> = {};
  let sourceLocale = '';

  for (const result of results) {
    const fieldName = result.contentKey.startsWith(prefix)
      ? result.contentKey.slice(prefix.length)
      : result.contentKey;
    translated[fieldName] = result.translatedText;

    if (!sourceLocale && result.sourceLocale) {
      sourceLocale = result.sourceLocale;
    }
  }

  return { translated, sourceLocale, targetLocale };
}
