import type { RJSFSchema, StrictRJSFSchema, UiSchema } from '@rjsf/utils';

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
// UI mapping for system fields
// ---------------------------------------------------------------------------

/**
 * System property keys that receive special collaborative UI wrappers.
 * Their *data* definition comes from the template; only the rendering
 * is overridden via `ui:field`.
 */
export const SYSTEM_FIELD_KEYS = new Set([
  'title',
  'description',
  'budget',
  'category',
]);

type SystemUiFactory = (t: (key: string) => string) => Record<string, unknown>;

/** Maps system field keys to their RJSF uiSchema entries. */
const SYSTEM_UI_MAP: Record<'title' | 'category' | 'budget', SystemUiFactory> =
  {
    title: (t) => ({
      'ui:field': 'CollaborativeTitleField',
      'ui:placeholder': t('Untitled Proposal'),
    }),
    category: () => ({ 'ui:field': 'CollaborativeCategoryField' }),
    budget: () => ({ 'ui:field': 'CollaborativeBudgetField' }),
  };

// ---------------------------------------------------------------------------
// compileProposalSchema
// ---------------------------------------------------------------------------

/**
 * Compiles a proposal template (JSON Schema 7) into an RJSF-ready schema
 * pair: a data schema and a uiSchema.
 *
 * The template is the single source of truth for data shape — property
 * types, constraints (`minimum`, `maximum`, `minLength`, etc.), and
 * `required` arrays are preserved as-is.
 *
 * This function only adds a UI layer:
 * - System fields (title, category, budget) get `ui:field` wrappers
 *   for collaborative editing components.
 * - Dynamic fields (everything else) get `ui:widget: CollaborativeShortText`.
 * - `description` is excluded from the RJSF form (rendered separately
 *   as a TipTap editor).
 *
 * @param proposalTemplate - JSON Schema 7 stored on processSchema.
 *   If null, a minimal schema with system fields using sensible defaults.
 * @param t - Translation function for field titles/placeholders.
 */
export function compileProposalSchema(
  proposalTemplate: StrictRJSFSchema | null,
  t: (key: string, params?: Record<string, string | number>) => string,
): {
  schema: RJSFSchema;
  uiSchema: UiSchema<Record<string, unknown>, RJSFSchema, ProposalFormContext>;
} {
  const template: StrictRJSFSchema = proposalTemplate ?? {
    type: 'object',
    properties: { title: { type: 'string', minLength: 1 } },
    required: ['title'],
  };

  const templateProperties = (template.properties ?? {}) as Record<
    string,
    StrictRJSFSchema
  >;
  const templateRequired = Array.isArray(template.required)
    ? template.required
    : [];

  // -- Build schema properties and uiSchema in one pass ----------------------

  const schemaProperties: Record<string, StrictRJSFSchema> = {};
  const uiProperties: Record<string, unknown> = {};

  for (const [key, propSchema] of Object.entries(templateProperties)) {
    // `description` is rendered as a standalone TipTap editor, not in RJSF.
    if (key === 'description') {
      continue;
    }

    if (SYSTEM_FIELD_KEYS.has(key)) {
      // System field: preserve the template's data definition, add UI mapping.
      schemaProperties[key] = propSchema;

      if (key in SYSTEM_UI_MAP) {
        const uiFactory = SYSTEM_UI_MAP[key as keyof typeof SYSTEM_UI_MAP];
        uiProperties[key] = uiFactory(t);
      }
    } else {
      // Dynamic field: pass through schema as-is, wire collaborative widget.
      schemaProperties[key] = propSchema;

      uiProperties[key] = {
        'ui:widget': 'CollaborativeShortText',
        'ui:options': { field: key },
      };
    }
  }

  // Ensure system fields always exist (even if the template omitted them).
  // Budget and category are nullable by default when not explicitly defined.
  if (!schemaProperties.title) {
    schemaProperties.title = {
      type: 'string',
      title: t('Title'),
      minLength: 1,
    };
    uiProperties.title = SYSTEM_UI_MAP.title(t);
  }
  if (!schemaProperties.category) {
    schemaProperties.category = {
      type: ['string', 'null'],
      title: t('Category'),
    };
    uiProperties.category = SYSTEM_UI_MAP.category(t);
  }
  if (!schemaProperties.budget) {
    schemaProperties.budget = {
      type: ['number', 'null'],
      title: t('Budget'),
      minimum: 0,
    };
    uiProperties.budget = SYSTEM_UI_MAP.budget(t);
  }

  // Ensure 'title' is always required
  const required = Array.from(new Set(['title', ...templateRequired])).filter(
    (key) => key in schemaProperties,
  );

  return {
    schema: {
      type: 'object',
      required,
      properties: schemaProperties,
    },
    uiSchema: uiProperties as UiSchema<
      Record<string, unknown>,
      RJSFSchema,
      ProposalFormContext
    >,
  };
}
