import type { DeepLClient, TargetLanguageCode } from 'deepl-node';
import he from 'he';
import pMap from 'p-map';

/** A single translated text plus the source language the provider detected. */
export type TranslationProviderResult = {
  translatedText: string;
  /** Uppercase source language code, or "UNKNOWN" if the provider can't detect it. */
  detectedSourceLang: string;
};

/**
 * Whether a text is a markup fragment or a bare string. It decides how the
 * provider is asked to treat tags: sending plain text through a markup-aware
 * translation makes DeepL parse it as a document, wrap it in a block element
 * and hand back `<p xmlns="http://www.w3.org/1999/xhtml">…</p>`.
 */
export type TranslationFormat = 'html' | 'text';

/** One text to translate, plus how it should be treated. */
export type TranslationInput = {
  text: string;
  format: TranslationFormat;
};

/**
 * A translation backend bound to a single target language. `translateBatch`
 * depends on this interface instead of a concrete client so different languages
 * can be routed to different services (e.g. Somali via OpenL, everything else
 * via DeepL).
 */
export interface TranslationProvider {
  translate(inputs: TranslationInput[]): Promise<TranslationProviderResult[]>;
}

/** Max DeepL requests in flight at once, to stay under DeepL's rate limits. */
const DEEPL_REQUEST_CONCURRENCY = 10;

/** DeepL-backed provider. Handles most languages. */
export class DeepLTranslationProvider implements TranslationProvider {
  constructor(
    private readonly client: DeepLClient,
    /** DeepL target language code, e.g. "EN-US" or "PT-BR". */
    private readonly targetLang: string,
  ) {}

  async translate(
    inputs: TranslationInput[],
  ): Promise<TranslationProviderResult[]> {
    // DeepL rejects any request carrying more than 50 text parameters, so
    // sending a whole proposal list in one call started failing once lists grew
    // past that cap. Translate each text in its own request (with bounded
    // concurrency) so batch size can never exceed DeepL's limit. pMap preserves
    // input order, so results line up 1:1 with the input.
    return pMap(inputs, (input) => this.translateOne(input), {
      concurrency: DEEPL_REQUEST_CONCURRENCY,
    });
  }

  private async translateOne({
    text,
    format,
  }: TranslationInput): Promise<TranslationProviderResult> {
    const result = await this.client.translateText(
      text,
      null,
      this.targetLang as TargetLanguageCode,
      // Only ask for tag handling on actual markup. With it on, DeepL parses
      // the input as a document, so a bare string comes back wrapped in
      // `<p xmlns="http://www.w3.org/1999/xhtml">`, which then renders as
      // literal text in every plain field (title, category, field labels).
      format === 'html' ? { tagHandling: 'html' } : {},
    );

    // A single-text input yields a single result object.
    const single = Array.isArray(result) ? result[0] : result;
    if (!single) {
      throw new Error('DeepL returned no translation for the submitted text.');
    }

    return {
      translatedText: he.decode(single.text),
      detectedSourceLang: single.detectedSourceLang.toUpperCase(),
    };
  }
}

const OPENL_ENDPOINT = 'https://openl-translate.p.rapidapi.com/translate/bulk';
const OPENL_HOST = 'openl-translate.p.rapidapi.com';
/** Total attempts before giving up; RapidAPI's gateway returns sporadic 5xx. */
const OPENL_MAX_ATTEMPTS = 3;
/** OpenL's PRO plan rejects requests with more than this many texts. */
const OPENL_MAX_TEXTS_PER_REQUEST = 20;
/** Max chunk requests in flight at once, to stay under OpenL's rate limits. */
const OPENL_REQUEST_CONCURRENCY = 4;

/**
 * OpenL-backed provider accessed via RapidAPI. Used for languages DeepL does
 * not support (currently Somali). OpenL preserves HTML tags and does not report
 * a detected source language, so `detectedSourceLang` is always "UNKNOWN".
 */
export class OpenLTranslationProvider implements TranslationProvider {
  constructor(
    private readonly apiKey: string,
    private readonly targetLang: string,
  ) {}

  async translate(
    inputs: TranslationInput[],
  ): Promise<TranslationProviderResult[]> {
    // OpenL has no tag-handling switch — it always treats input as plain text —
    // so `format` is not consulted here.
    const texts = inputs.map((input) => input.text);
    // OpenL caps texts per request, so split into chunks and translate them
    // with bounded concurrency (pMap preserves input order, so the reassembled
    // array lines up 1:1 with the input — translateBatch maps results back to
    // entries by index).
    const chunks = chunk(texts, OPENL_MAX_TEXTS_PER_REQUEST);
    const chunkResults = await pMap(
      chunks,
      (chunkTexts) => this.requestWithRetry(chunkTexts),
      { concurrency: OPENL_REQUEST_CONCURRENCY },
    );
    const translatedTexts = chunkResults.flat();

    if (translatedTexts.length !== texts.length) {
      throw new Error(
        `OpenL returned ${translatedTexts.length} translations for ${texts.length} inputs.`,
      );
    }

    return translatedTexts.map((text) => ({
      translatedText: he.decode(text),
      detectedSourceLang: 'UNKNOWN',
    }));
  }

  /** POST to OpenL, retrying on network errors and 5xx/429 gateway responses. */
  private async requestWithRetry(texts: string[]): Promise<string[]> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= OPENL_MAX_ATTEMPTS; attempt++) {
      let response: Response;
      try {
        response = await fetch(OPENL_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-host': OPENL_HOST,
            'x-rapidapi-key': this.apiKey,
            // Node's fetch defaults to `Accept-Encoding: gzip, deflate`, but
            // OpenL's RapidAPI gateway fails to transform the compressed
            // response for HTML payloads and returns a 502. Request an
            // unencoded response (as curl does by default) to avoid that.
            'Accept-Encoding': 'identity',
          },
          body: JSON.stringify({ target_lang: this.targetLang, text: texts }),
        });
      } catch (error) {
        // Network-level failure — worth retrying.
        lastError = error;
        if (attempt < OPENL_MAX_ATTEMPTS) {
          await delay(attempt * 500);
        }
        continue;
      }

      // A 2xx means the request reached OpenL; parsing failures are
      // deterministic, so let them throw immediately rather than retry.
      if (response.ok) {
        return parseOpenLResponse(await response.json());
      }

      const body = await response.text();
      lastError = new Error(
        `OpenL translation request failed (${response.status}): ${body}`,
      );
      // 4xx (other than rate limiting) won't succeed on retry — fail fast.
      if (response.status < 500 && response.status !== 429) {
        break;
      }

      if (attempt < OPENL_MAX_ATTEMPTS) {
        await delay(attempt * 500);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('OpenL translation request failed.');
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Split an array into consecutive chunks of at most `size` items. */
function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** Validate the OpenL bulk-translate response shape without unsafe casts. */
function parseOpenLResponse(value: unknown): string[] {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('translatedTexts' in value)
  ) {
    throw new Error('OpenL response is missing "translatedTexts".');
  }

  const { translatedTexts } = value;
  if (
    !Array.isArray(translatedTexts) ||
    !translatedTexts.every((entry) => typeof entry === 'string')
  ) {
    throw new Error('OpenL response "translatedTexts" is not a string array.');
  }

  return translatedTexts;
}
