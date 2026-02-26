import type { XFormat, XFormatPropertySchema } from '@op/common/client';

/**
 * A compiled field descriptor produced by a schema compiler. Describes a
 * single field with everything needed to render it.
 */
export interface FieldDescriptor {
  /** Property key in the schema (e.g. "title", "summary"). */
  key: string;
  /** Resolved display format. */
  format: XFormat;
  /** Whether this is a system field (title, category, budget). Only relevant for proposals. */
  isSystem?: boolean;
  /** The raw property schema definition for this field. */
  schema: XFormatPropertySchema;
}
