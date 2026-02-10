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

/**
 * Supported values for the `x-format` vendor extension on template properties.
 *
 * `x-format` describes **how** a field should be presented, while JSON Schema's
 * own keywords (`type`, `enum`, etc.) describe the data shape. The compiler
 * maps each `x-format` to RJSF widget/field config via {@link FORMAT_REGISTRY}.
 *
 * Additional per-field presentation options (e.g. `rich`, `maxWords`) can be
 * provided in a sibling `x-format-options` object — the compiler merges them
 * into `ui:options` so the widget receives them at runtime.
 */
export type XFormat = 'short-text' | 'long-text' | 'money' | 'category';

// ---------------------------------------------------------------------------
// x-format → RJSF ui mapping
// ---------------------------------------------------------------------------

interface FormatConfig {
  widget?: string;
  field?: string;
  /** Default `ui:options` merged with any `x-format-options` from the template. */
  defaults?: Record<string, unknown>;
}

/**
 * Registry mapping `x-format` values to RJSF uiSchema entries.
 *
 * Adding a new display type is a single line here + the widget/field component.
 */
const FORMAT_REGISTRY: Record<XFormat, FormatConfig> = {
  'short-text': { widget: 'CollaborativeText' },
  'long-text': { widget: 'CollaborativeText', defaults: { multiline: true } },
  money: { field: 'CollaborativeBudgetField' },
  category: { field: 'CollaborativeCategoryField' },
};

/** Default `x-format` when a dynamic field omits the extension. */
const DEFAULT_X_FORMAT: XFormat = 'short-text';

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
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads `x-format` and `x-format-options` from a property schema and returns
 * the corresponding RJSF uiSchema entry.
 *
 * @param key - Property key (used as the default Yjs fragment name).
 * @param propSchema - The JSON Schema property definition (may include vendor extensions).
 */
function resolveFormatUi(
  key: string,
  propSchema: StrictRJSFSchema,
): Record<string, unknown> {
  const raw = propSchema as Record<string, unknown>;
  const xFormat = (raw['x-format'] as XFormat | undefined) ?? DEFAULT_X_FORMAT;
  const xFormatOptions =
    (raw['x-format-options'] as Record<string, unknown>) ?? {};

  const config = FORMAT_REGISTRY[xFormat] ?? FORMAT_REGISTRY[DEFAULT_X_FORMAT];

  return {
    ...(config.widget && { 'ui:widget': config.widget }),
    ...(config.field && { 'ui:field': config.field }),
    'ui:options': { field: key, ...config.defaults, ...xFormatOptions },
  };
}

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
 * - Dynamic fields use `x-format` (vendor extension) to look up the
 *   appropriate widget/field from {@link FORMAT_REGISTRY}. Falls back
 *   to `short-text` when `x-format` is absent.
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

    // Always pass through the template's data definition.
    schemaProperties[key] = propSchema;

    if (SYSTEM_FIELD_KEYS.has(key)) {
      // System field: fixed UI mapping.
      if (key in SYSTEM_UI_MAP) {
        const uiFactory = SYSTEM_UI_MAP[key as keyof typeof SYSTEM_UI_MAP];
        uiProperties[key] = uiFactory(t);
      }
    } else {
      // Dynamic field: resolve UI from x-format.
      uiProperties[key] = resolveFormatUi(key, propSchema);
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
