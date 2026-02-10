import type { RJSFSchema, UiSchema } from '@rjsf/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Extra props passed to RJSF fields/widgets via `formContext`.
 * Contains runtime data that the schema alone can't express.
 */
export interface ProposalFormContext {
  categories: Array<{ id: string; name: string }>;
  budgetCapAmount?: number;
}

// ---------------------------------------------------------------------------
// Schema compilation — proposalTemplate (JSON Schema) -> RJSF schema + uiSchema
// ---------------------------------------------------------------------------

/**
 * Known system property keys in the proposal template schema.
 * These get special `ui:field` rendering (collaborative wrappers)
 * and are persisted to proposalData. Everything else is treated
 * as a dynamic template field rendered via `CollaborativeShortText`.
 */
export const SYSTEM_FIELD_KEYS = new Set([
  'title',
  'description',
  'budget',
  'category',
]);

/**
 * Builds the complete RJSF schema and uiSchema from the stored
 * `processSchema.proposalTemplate` (JSON Schema).
 *
 * System fields (title, category, budget) get dedicated `ui:field`
 * wrappers that use our collaborative components.
 * Dynamic fields (user-created via template builder) get rendered
 * as `CollaborativeShortText` widgets backed by Yjs fragments.
 * Dynamic field values live exclusively in Yjs — they are NOT
 * persisted to proposalData.
 *
 * @param proposalTemplate - The raw JSON Schema stored on processSchema
 * @param budgetCapAmount - Optional budget ceiling from phase settings
 * @param t - Translation function
 */
export function compileProposalSchema(
  proposalTemplate: Record<string, unknown> | null,
  budgetCapAmount: number | undefined,
  t: (key: string, params?: Record<string, string | number>) => string,
): {
  schema: RJSFSchema;
  uiSchema: UiSchema<Record<string, unknown>, RJSFSchema, ProposalFormContext>;
} {
  // Pull required array from stored template
  const templateRequired =
    proposalTemplate &&
    'required' in proposalTemplate &&
    Array.isArray(proposalTemplate.required)
      ? (proposalTemplate.required as string[])
      : [];

  const isCategoryRequired = templateRequired.includes('category');

  // System fields — always present regardless of template contents
  const schemaProperties: NonNullable<RJSFSchema['properties']> = {
    title: { type: 'string', title: t('Title'), minLength: 1 },
    category: {
      type: isCategoryRequired ? 'string' : ['string', 'null'],
      title: t('Category'),
    },
    budget: {
      type: ['number', 'null'],
      title: t('Budget'),
      minimum: 0,
      ...(budgetCapAmount ? { maximum: budgetCapAmount } : {}),
    },
  };

  const uiProperties: Record<string, unknown> = {
    title: {
      'ui:field': 'CollaborativeTitleField',
      'ui:placeholder': t('Untitled Proposal'),
    },
    category: { 'ui:field': 'CollaborativeCategoryField' },
    budget: { 'ui:field': 'CollaborativeBudgetField' },
  };

  // Merge dynamic (non-system) properties from the stored template
  if (
    proposalTemplate &&
    'properties' in proposalTemplate &&
    proposalTemplate.properties &&
    typeof proposalTemplate.properties === 'object'
  ) {
    const templateProps = proposalTemplate.properties as Record<
      string,
      Record<string, unknown>
    >;

    for (const [key, propSchema] of Object.entries(templateProps)) {
      if (SYSTEM_FIELD_KEYS.has(key)) {
        continue;
      }

      // Dynamic field — add to schema and wire as collaborative short text.
      // The field key is used as both the JSON Schema property name
      // and the Yjs fragment name for collaborative editing.
      schemaProperties[key] = {
        type: 'string',
        ...(propSchema.title ? { title: String(propSchema.title) } : {}),
        ...(propSchema.description
          ? { description: String(propSchema.description) }
          : {}),
      };

      uiProperties[key] = {
        'ui:widget': 'CollaborativeShortText',
        'ui:options': { field: key },
      };
    }
  }

  const required = Array.from(new Set(['title', ...templateRequired])).filter(
    (key) => key in schemaProperties,
  );

  return {
    schema: { type: 'object', required, properties: schemaProperties },
    uiSchema: uiProperties as UiSchema<
      Record<string, unknown>,
      RJSFSchema,
      ProposalFormContext
    >,
  };
}
