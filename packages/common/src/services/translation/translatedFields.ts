import type { TranslatableEntry, TranslationResult } from '@op/translation';

export type TranslatedFieldValue = string | string[];

/**
 * Upper bound on a reconstructed array index. Genuine translatable arrays (e.g.
 * multi-select categories) have small, dense indices starting at 0. A key whose
 * trailing `:<digits>` segment exceeds this is not an array element — it's a
 * field whose id happens to be numeric (e.g. `field_title:77963788`, where the
 * proposal template's field id is all digits). Treating that id as an array
 * index makes `items[77963788] = …` allocate a ~78-million-element sparse array,
 * which OOMs the process (ONE-401). Above the cap we fall back to a scalar key.
 */
const MAX_ARRAY_INDEX = 10_000;
export type TranslatedFields = Record<string, TranslatedFieldValue>;
export type TranslatableFields = Record<
  string,
  TranslatedFieldValue | null | undefined
>;

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
        contentKey: `${prefix}${fieldName}:${index}`,
        text: item,
      });
    });
  }

  return entries;
}

/**
 * Reconstructs flattened translation results back into the original field
 * shape, preserving arrays for fields encoded as `field:index`.
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
    const arrayMatch = /^(?<field>.+):(?<index>\d+)$/.exec(fieldKey);
    const fieldName = arrayMatch?.groups?.field;
    const indexValue = arrayMatch?.groups?.index;

    const index = indexValue ? Number.parseInt(indexValue, 10) : NaN;

    if (fieldName && !Number.isNaN(index) && index <= MAX_ARRAY_INDEX) {
      const currentValue = translated[fieldName];
      const items = Array.isArray(currentValue) ? currentValue.slice() : [];
      items[index] = result.translatedText;
      translated[fieldName] = items;
    } else {
      // Not an array element (no `:<index>` suffix, or the suffix is a numeric
      // field id above MAX_ARRAY_INDEX) — store under the full key as a scalar.
      translated[fieldKey] = result.translatedText;
    }

    if (!sourceLocale && result.sourceLocale) {
      sourceLocale = result.sourceLocale;
    }
  }

  return { translated, sourceLocale };
}
