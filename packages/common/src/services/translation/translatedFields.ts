import type { TranslatableEntry, TranslationResult } from '@op/translation';

export type TranslatedFieldValue = string | string[];
export type TranslatedFields = Record<string, TranslatedFieldValue>;
export type TranslatableFields = Record<
  string,
  TranslatedFieldValue | null | undefined
>;

/**
 * Content-key pattern for an array element: `field[index]`. The bracketed index
 * is what lets `unflattenTranslatedFields` tell a genuine array element apart
 * from a scalar field whose id merely ends in digits — e.g. a proposal template
 * field id like `field_title:77963788`. The previous `field:index` encoding was
 * ambiguous: that id parsed as array index 77_963_788, so `items[index] = …`
 * allocated a ~78-million-element sparse array and OOM-killed the process
 * (ONE-401). Brackets can't appear in our field ids, so there's no collision.
 */
const ARRAY_ELEMENT_PATTERN = /^(?<field>.+)\[(?<index>\d+)\]$/;

/**
 * Flattens string and string[] fields into translation entries while keeping a
 * reversible content-key structure for arrays.
 *
 * Everything here is a bare string — titles, categories, previews — so entries
 * are marked `text`. Rich-text fields are rendered to HTML and pushed by their
 * own callers.
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
        format: 'text',
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
        format: 'text',
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
    const arrayMatch = ARRAY_ELEMENT_PATTERN.exec(fieldKey);
    const fieldName = arrayMatch?.groups?.field;
    const indexValue = arrayMatch?.groups?.index;

    if (fieldName && indexValue !== undefined) {
      const index = Number.parseInt(indexValue, 10);
      const currentValue = translated[fieldName];
      const items = Array.isArray(currentValue) ? currentValue.slice() : [];
      items[index] = result.translatedText;
      translated[fieldName] = items;
    } else {
      // Scalar field — stored under its full key. Field ids that merely end in
      // digits (no `[index]` marker) land here instead of being mistaken for
      // array elements.
      translated[fieldKey] = result.translatedText;
    }

    if (!sourceLocale && result.sourceLocale) {
      sourceLocale = result.sourceLocale;
    }
  }

  return { translated, sourceLocale };
}
