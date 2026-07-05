import type { LanguageIdentifier } from 'cld3-asm';

// CLD3 needs a reasonable byte sample to make a reliable call; below the
// minimum it always returns `und` (undetermined), and it only inspects the
// first `MAX_DETECTION_BYTES` of the input.
const MIN_DETECTION_BYTES = 20;
const MAX_DETECTION_BYTES = 2000;
const MAX_LANGUAGES = 3;

/** CLD3's sentinel code for "couldn't tell". */
const UNDETERMINED = 'und';

// The CLD3 WASM binary is ~1MB, so load it once on first use and reuse the same
// identifier instance across every detection call.
let identifierPromise: Promise<LanguageIdentifier> | null = null;

const getIdentifier = (): Promise<LanguageIdentifier> => {
  if (!identifierPromise) {
    identifierPromise = import('cld3-asm').then(({ loadModule }) =>
      loadModule().then((factory) =>
        factory.create(MIN_DETECTION_BYTES, MAX_DETECTION_BYTES),
      ),
    );
  }
  return identifierPromise;
};

/** The base language subtag, lowercased — e.g. `en` from `en-US`, `zh` from `zh-Latn`. */
export const baseLanguage = (code: string): string =>
  code.toLowerCase().split('-')[0] ?? code;

/**
 * Detects which languages appear in `text` using CLD (Compact Language
 * Detector v3). Returns the reliably-detected base language codes, or an empty
 * array when the text is too short to judge, undetermined, or detection fails.
 */
export const detectLanguages = async (text: string): Promise<string[]> => {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const identifier = await getIdentifier();
    const results = identifier.findMostFrequentLanguages(
      trimmed,
      MAX_LANGUAGES,
    );
    const languages = results
      .filter((result) => result.is_reliable)
      .map((result) => baseLanguage(result.language))
      .filter((language) => language !== UNDETERMINED);

    return Array.from(new Set(languages));
  } catch {
    return [];
  }
};
