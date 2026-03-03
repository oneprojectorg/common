import type { TranslatableEntry, TranslationResult } from '@op/translation';
import { translateBatch } from '@op/translation';
import { DeepLClient } from 'deepl-node';

import { CommonError } from '../../utils';
import { LOCALE_TO_DEEPL } from './locales';
import type { SupportedLocale } from './locales';

/**
 * Shared helper that validates the DeepL API key, builds a client, and runs
 * a batch translation. Both `translateProposal` and `translateProposals`
 * delegate here so the key-check + client construction isn't duplicated.
 */
export async function runTranslateBatch(
  entries: TranslatableEntry[],
  targetLocale: SupportedLocale,
): Promise<TranslationResult[]> {
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    throw new CommonError('DEEPL_API_KEY is not configured');
  }

  const client = new DeepLClient(apiKey);
  return translateBatch({
    entries,
    targetLocale: LOCALE_TO_DEEPL[targetLocale],
    client,
  });
}
