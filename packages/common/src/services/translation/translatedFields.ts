import type { TranslatableEntry, TranslationResult } from '@op/translation';

export type TranslatedFieldValue = string | string[];
export type TranslatedFields = Record<string, TranslatedFieldValue>;
export type TranslatableFields = Record<
  string,
  TranslatedFieldValue | null | undefined
>;

/**
 * Array entries are encoded as `field[index]` rather than `field:index`:
 * scalar content keys built elsewhere (e.g. `field_title:<fieldKey>`) can end
 * in an all-digit segment when a template field key happens to be numeric,
 * and a colon-based encoding misread those as array indices — allocating
 * arrays with tens of millions of slots and OOMing the API process.
 */
const ARRAY_INDEX_PATTERN = /^(?<field>.+)\[(?<index>\d{1,4})\]$/;

/**
 * Flattens string and string[] fields into translation entries while keeping a
 * reversible content-key structure for arrays.
 */
export function flattenTranslatableFields(
  prefix: string,
  fields: TranslatableFields,
): TranslatableEntry[] {
  const entries: TranslatableEntry[] = [];

  for (const [fieldName, value] of Object.entries(fields)) {
    if (!value) {
      continue;
    }

    if (typeof value === 'string') {
      entries.push({
        contentKey: `${prefix}${fieldName}`,
        text: value,
      });
      continue;
    }

    value.forEach((item, index) => {
      if (!item) {
        return;
      }

      entries.push({
        contentKey: `${prefix}${fieldName}[${index}]`,
        text: item,
      });
    });
  }

  return entries;
}

/**
 * Reconstructs flattened translation results back into the original field
 * shape, preserving arrays for fields encoded as `field[index]`.
 */
export function unflattenTranslatedFields(
  prefix: string,
  results: TranslationResult[],
): {
  translated: TranslatedFields;
  sourceLocale: string;
} {
  const translated: TranslatedFields = {};
  let sourceLocale = '';

  for (const result of results) {
    if (!result.contentKey.startsWith(prefix)) {
      continue;
    }

    const fieldKey = result.contentKey.slice(prefix.length);
    const arrayMatch = ARRAY_INDEX_PATTERN.exec(fieldKey);
    const fieldName = arrayMatch?.groups?.field;
    const indexValue = arrayMatch?.groups?.index;

    if (fieldName && indexValue) {
      const index = Number.parseInt(indexValue, 10);

      if (!Number.isNaN(index)) {
        const currentValue = translated[fieldName];
        const items = Array.isArray(currentValue) ? currentValue.slice() : [];
        items[index] = result.translatedText;
        translated[fieldName] = items;
      }
    } else {
      translated[fieldKey] = result.translatedText;
    }

    if (!sourceLocale && result.sourceLocale) {
      sourceLocale = result.sourceLocale;
    }
  }

  return { translated, sourceLocale };
}
