import { db } from '@op/db/client';

import { NotFoundError } from '../../utils';
import type { CustomFormDefinitionSchema } from '../customForms/schemas/customForm';
import type { XFormatPropertySchema } from '../decision/types';
import type { SupportedLocale } from './locales';
import { runTranslateBatch } from './runTranslateBatch';

/**
 * Keys: `title`, `description`, `field_title:<field>`, `field_desc:<field>`
 * and `option:<field>:<value>`.
 */
export type CustomFormTranslation = Record<string, string>;

/**
 * Translates the admin-authored text of a custom form: its title and
 * description, each field's title and description, and each choice label.
 */
export async function translateCustomForm({
  customFormId,
  targetLocale,
}: {
  customFormId: string;
  targetLocale: SupportedLocale;
}): Promise<{
  translated: CustomFormTranslation;
  sourceLocale: string;
  targetLocale: SupportedLocale;
}> {
  const form = await db.query.customForms.findFirst({
    where: { id: customFormId, deletedAt: { isNull: true } },
    columns: { id: true, schema: true },
  });

  if (!form) {
    throw new NotFoundError('Custom form', customFormId);
  }

  const prefix = `custom_form:${form.id}:`;
  // The jsonb column holds the same JSON Schema dialect the modal renders.
  const definition = form.schema as CustomFormDefinitionSchema;
  const entries = getCustomFormEntries(definition).map(({ key, text }) => ({
    contentKey: `${prefix}${key}`,
    text,
  }));

  if (entries.length === 0) {
    return { translated: {}, sourceLocale: '', targetLocale };
  }

  const results = await runTranslateBatch(entries, targetLocale);

  const translated: CustomFormTranslation = {};
  let sourceLocale = '';
  for (const result of results) {
    translated[result.contentKey.slice(prefix.length)] = result.translatedText;
    sourceLocale ||= result.sourceLocale ?? '';
  }

  return { translated, sourceLocale, targetLocale };
}

function getCustomFormEntries(
  definition: CustomFormDefinitionSchema,
): { key: string; text: string }[] {
  const entries: { key: string; text: string }[] = [];
  const push = (key: string, text: unknown) => {
    if (typeof text === 'string' && text.trim()) {
      entries.push({ key, text });
    }
  };

  push('title', definition.title);
  push('description', definition.description);

  for (const [fieldKey, field] of Object.entries(
    definition.properties ?? {},
  )) {
    if (!field || typeof field !== 'object') {
      continue;
    }
    push(`field_title:${fieldKey}`, field.title);
    push(`field_desc:${fieldKey}`, field.description);
    for (const option of getEnumOptions(field)) {
      push(`option:${fieldKey}:${option}`, option);
    }
  }

  return entries;
}

/** A single-choice field's `enum`, or a multi-select's `items.enum`. */
function getEnumOptions(field: XFormatPropertySchema): string[] {
  const items =
    typeof field.items === 'object' && !Array.isArray(field.items)
      ? field.items
      : undefined;
  const options = field.enum ?? items?.enum;

  if (!Array.isArray(options)) {
    return [];
  }

  return options.filter(
    (option): option is string => typeof option === 'string',
  );
}
