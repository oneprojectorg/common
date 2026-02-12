import type { JSONSchema7 } from 'json-schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Supported values for the `x-format` vendor extension on template properties.
 *
 * `x-format` describes **how** a field should be presented, while JSON Schema's
 * own keywords (`type`, `enum`, etc.) describe the data shape.
 */
export type XFormat = 'short-text' | 'long-text' | 'money' | 'category';

/**
 * JSON Schema 7 extended with proposal-specific vendor extensions.
 */
export interface ProposalPropertySchema extends JSONSchema7 {
  'x-format'?: string;
  'x-currency'?: string;
}

export interface ProposalTemplateSchema extends JSONSchema7 {
  properties?: Record<string, ProposalPropertySchema>;
  'x-field-order'?: string[];
}

/**
 * System property keys that receive special collaborative UI wrappers.
 * Their *data* definition comes from the template; only the rendering
 * is overridden.
 */
export const SYSTEM_FIELD_KEYS = new Set(['title', 'budget', 'category']);

/** System fields that must always be present. Others are conditionally added. */
const REQUIRED_SYSTEM_FIELDS = new Set(['title']);

/** Default `x-format` when a dynamic field omits the extension. */
const DEFAULT_X_FORMAT: XFormat = 'short-text';

// ---------------------------------------------------------------------------
// Compiled field descriptor
// ---------------------------------------------------------------------------

/**
 * A field descriptor produced by the schema compiler. Each entry describes
 * a single field in the proposal form, with all the information needed to
 * render the correct collaborative component.
 */
export interface ProposalFieldDescriptor {
  /** Property key in the schema (e.g. "title", "summary"). */
  key: string;
  /** Resolved display format. */
  format: XFormat;
  /** Whether this is a system field (title, category, budget). */
  isSystem: boolean;
  /** The raw property schema definition for this field. */
  schema: ProposalPropertySchema;
}

// ---------------------------------------------------------------------------
// compileProposalSchema
// ---------------------------------------------------------------------------

/**
 * Compiles a proposal template into an array of field descriptors that the
 * renderer can iterate over.
 *
 * The template is the single source of truth for data shape — property
 * types, constraints (`minimum`, `maximum`, `minLength`, etc.), and
 * `required` arrays are preserved as-is.
 *
 * This function resolves the `x-format` vendor extension on each property
 * into a typed descriptor. The template is expected to include system fields
 * (title, category, budget) — missing ones are logged as errors.
 *
 * @param proposalTemplate - Proposal template schema stored on processSchema.
 * @param t - Translation function for field titles/placeholders.
 */
export function compileProposalSchema(
  proposalTemplate: ProposalTemplateSchema,
): ProposalFieldDescriptor[] {
  const templateProperties = proposalTemplate.properties ?? {};

  for (const key of REQUIRED_SYSTEM_FIELDS) {
    if (!templateProperties[key]) {
      console.error(`[compileProposalSchema] Missing system field "${key}"`);
    }
  }

  const fieldOrder = proposalTemplate['x-field-order'] ?? [];

  /** Build a descriptor for a single property key. */
  function buildDescriptor(
    key: string,
    propSchema: ProposalPropertySchema,
  ): ProposalFieldDescriptor {
    return {
      key,
      format:
        (propSchema['x-format'] as XFormat | undefined) ?? DEFAULT_X_FORMAT,
      isSystem: SYSTEM_FIELD_KEYS.has(key),
      schema: propSchema,
    };
  }

  const fields: ProposalFieldDescriptor[] = [];
  const seen = new Set<string>();

  // System fields first (title, then category/budget if present)
  for (const sysKey of SYSTEM_FIELD_KEYS) {
    const propSchema = templateProperties[sysKey];
    if (propSchema) {
      fields.push(buildDescriptor(sysKey, propSchema));
      seen.add(sysKey);
    }
  }

  // Dynamic fields in x-field-order sequence
  for (const key of fieldOrder) {
    if (seen.has(key)) {
      continue;
    }
    const propSchema = templateProperties[key];
    if (propSchema) {
      fields.push(buildDescriptor(key, propSchema));
      seen.add(key);
    }
  }

  // Any remaining properties not in x-field-order (fallback)
  for (const [key, propSchema] of Object.entries(templateProperties)) {
    if (!seen.has(key)) {
      fields.push(buildDescriptor(key, propSchema));
    }
  }

  return fields;
}
