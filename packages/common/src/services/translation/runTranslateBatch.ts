import type {
  TranslatableEntry,
  TranslationProvider,
  TranslationResult,
} from '@op/translation';
import {
  DeepLTranslationProvider,
  OpenLTranslationProvider,
  translateBatch,
} from '@op/translation';
import { DeepLClient } from 'deepl-node';

import { CommonError } from '../../utils';
import { LOCALE_TO_DEEPL, LOCALE_TO_OPENL, usesOpenL } from './locales';
import type { SupportedLocale } from './locales';

/**
 * Shared helper that picks the right translation provider for the target
 * locale and runs a batch translation. Somali (and any other locale DeepL does
 * not support) is routed to OpenL via RapidAPI; everything else goes to DeepL.
 * All domain services delegate here so provider selection and cache-through
 * semantics aren't duplicated.
 */
export async function runTranslateBatch(
  entries: TranslatableEntry[],
  targetLocale: SupportedLocale,
): Promise<TranslationResult[]> {
  return translateBatch({
    entries,
    // Keep the DeepL-style code as the cache key so translations for a locale
    // share a cache regardless of which provider produced them.
    targetLocale: LOCALE_TO_DEEPL[targetLocale],
    provider: createProvider(targetLocale),
  });
}

function createProvider(targetLocale: SupportedLocale): TranslationProvider {
  if (usesOpenL(targetLocale)) {
    const apiKey = process.env.OPENL_RAPIDAPI_KEY;
    if (!apiKey) {
      throw new CommonError('OPENL_RAPIDAPI_KEY is not configured');
    }
    return new OpenLTranslationProvider(apiKey, LOCALE_TO_OPENL[targetLocale]);
  }

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    throw new CommonError('DEEPL_API_KEY is not configured');
  }
  return new DeepLTranslationProvider(
    new DeepLClient(apiKey),
    LOCALE_TO_DEEPL[targetLocale],
  );
}
