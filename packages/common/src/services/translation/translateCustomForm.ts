import { db } from '@op/db/client';

import { NotFoundError } from '../../utils';
import type { CustomFormDefinitionSchema } from '../customForms/schemas/customForm';
import type { SupportedLocale } from './locales';
import { runTranslateBatch } from './runTranslateBatch';
import {
  type TranslatedFields,
  flattenSchemaFields,
  flattenTranslatableFields,
  unflattenTranslatedFields,
} from './translatedFields';

/**
 * Translates the admin-authored text of a custom form: its title and
 * description, each field's title and description, and each option label.
 */
export async function translateCustomForm({
  customFormId,
  targetLocale,
}: {
  customFormId: string;
  targetLocale: SupportedLocale;
}): Promise<{
  translated: TranslatedFields;
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
  // The jsonb column holds the same JSON Schema dialect as proposal templates.
  const definition = form.schema as CustomFormDefinitionSchema;
  const entries = [
    ...flattenTranslatableFields(prefix, {
      title: definition.title,
      description: definition.description,
    }),
    ...flattenSchemaFields(prefix, definition.properties),
  ];

  if (entries.length === 0) {
    return { translated: {}, sourceLocale: '', targetLocale };
  }

  const results = await runTranslateBatch(entries, targetLocale);

  return { ...unflattenTranslatedFields(prefix, results), targetLocale };
}
