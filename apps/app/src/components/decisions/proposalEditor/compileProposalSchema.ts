import {
  type ProposalTemplateSchema,
  SYSTEM_FIELD_KEYS,
  type XFormat,
  type XFormatPropertySchema,
  getProposalTemplateFieldOrder,
} from '@op/common/client';

export type { XFormatPropertySchema, ProposalTemplateSchema, XFormat };

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
  schema: XFormatPropertySchema;
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

  const { all } = getProposalTemplateFieldOrder(proposalTemplate);

  return all
    .map((key) => {
      const propSchema = templateProperties[key];
      if (!propSchema) {
        return null;
      }
      return {
        key,
        format: propSchema['x-format'] ?? DEFAULT_X_FORMAT,
        isSystem: SYSTEM_FIELD_KEYS.has(key),
        schema: propSchema,
      };
    })
    .filter((d): d is ProposalFieldDescriptor => d !== null);
}
