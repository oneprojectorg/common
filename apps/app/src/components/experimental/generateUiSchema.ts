import type { RJSFSchema, UiSchema } from '@rjsf/utils';

/**
 * Options for uiSchema generation.
 */
export interface GenerateUiSchemaOptions {
  /**
   * When true, string fields use collaborative widgets (CollaborativeText, CollaborativeRichText).
   * When false, uses standard widgets (TextareaWidget, RichTextEditor).
   */
  collaborative?: boolean;
}

/**
 * Extended JSON Schema property with our custom format values.
 * We use `format: "richtext"` to signal rich text fields.
 */
interface SchemaProperty {
  type?: string | string[];
  format?: string;
  enum?: unknown[];
  title?: string;
  description?: string;
  properties?: Record<string, SchemaProperty>;
  items?: SchemaProperty;
  maxLength?: number;
  [key: string]: unknown;
}

/**
 * Generates a RJSF uiSchema from a JSON Schema.
 *
 * Convention:
 * - `type: "string"` with `format: "richtext"` → rich text widget
 * - `type: "string"` with `enum` → select (default RJSF behavior, no override needed)
 * - `type: "string"` (plain) → text/textarea widget
 * - `type: "number"` with `format: "currency"` → number widget (could extend later)
 * - `type: "boolean"` → checkbox (default RJSF behavior)
 *
 * When `collaborative: true`, text fields use CollaborativeText/CollaborativeRichText.
 * When `collaborative: false`, uses standard TextareaWidget/RichTextEditor.
 *
 * @example
 * ```ts
 * const schema = {
 *   type: 'object',
 *   properties: {
 *     title: { type: 'string', title: 'Title' },
 *     description: { type: 'string', format: 'richtext', title: 'Description' }
 *   }
 * };
 *
 * const uiSchema = generateUiSchema(schema, { collaborative: true });
 * // Result:
 * // {
 * //   title: { 'ui:widget': 'CollaborativeText', 'ui:options': { field: 'title' } },
 * //   description: { 'ui:widget': 'CollaborativeRichText', 'ui:options': { field: 'description' } }
 * // }
 * ```
 */
export function generateUiSchema(
  schema: RJSFSchema,
  options: GenerateUiSchemaOptions = {},
): UiSchema {
  const { collaborative = false } = options;

  const uiSchema: UiSchema = {};
  const properties = schema.properties as
    | Record<string, SchemaProperty>
    | undefined;

  if (!properties) {
    return uiSchema;
  }

  for (const [fieldName, prop] of Object.entries(properties)) {
    const fieldUiSchema = generateFieldUiSchema(fieldName, prop, {
      collaborative,
    });

    if (fieldUiSchema) {
      uiSchema[fieldName] = fieldUiSchema;
    }
  }

  return uiSchema;
}

/**
 * Generate uiSchema for a single field.
 * Returns undefined if no override is needed (RJSF defaults are fine).
 */
function generateFieldUiSchema(
  fieldName: string,
  prop: SchemaProperty,
  options: { collaborative: boolean },
): UiSchema | undefined {
  const { collaborative } = options;
  const propType = Array.isArray(prop.type) ? prop.type[0] : prop.type;

  // Handle nested objects recursively
  if (propType === 'object' && prop.properties) {
    const nestedUiSchema: UiSchema = {};
    let hasOverrides = false;

    for (const [nestedName, nestedProp] of Object.entries(prop.properties)) {
      const nestedFieldUi = generateFieldUiSchema(
        nestedName,
        nestedProp,
        options,
      );
      if (nestedFieldUi) {
        nestedUiSchema[nestedName] = nestedFieldUi;
        hasOverrides = true;
      }
    }

    return hasOverrides ? nestedUiSchema : undefined;
  }

  // Handle arrays - check items schema
  if (propType === 'array' && prop.items) {
    const itemsUiSchema = generateFieldUiSchema('items', prop.items, options);
    if (itemsUiSchema) {
      return { items: itemsUiSchema };
    }
    return undefined;
  }

  // String fields - the main logic
  if (propType === 'string') {
    // Enum fields → let RJSF use default select widget
    if (prop.enum) {
      return undefined;
    }

    // Rich text fields
    if (prop.format === 'richtext') {
      return {
        'ui:widget': collaborative ? 'CollaborativeRichText' : 'RichTextEditor',
        'ui:options': {
          field: fieldName,
          className: 'min-h-52',
        },
      };
    }

    // Date fields → let RJSF handle with format: date
    if (prop.format === 'date' || prop.format === 'date-time') {
      return undefined;
    }

    // Plain text fields
    // Use textarea for longer text (no maxLength or maxLength > 100)
    const isLongText = !prop.maxLength || prop.maxLength > 100;

    if (collaborative) {
      return {
        'ui:widget': 'CollaborativeText',
        'ui:options': {
          field: fieldName,
        },
      };
    }

    // Non-collaborative: use textarea for long text
    if (isLongText) {
      return {
        'ui:widget': 'textarea',
      };
    }

    // Short text - let RJSF use default text input
    return undefined;
  }

  // Number fields - could add currency handling later
  if (propType === 'number' || propType === 'integer') {
    // Let RJSF handle numbers with default widget
    // Future: could check format: "currency" for custom handling
    return undefined;
  }

  // Boolean - let RJSF use default checkbox
  if (propType === 'boolean') {
    return undefined;
  }

  return undefined;
}

/**
 * Merges a generated uiSchema with manual overrides.
 * Manual overrides take precedence.
 *
 * @example
 * ```ts
 * const generated = generateUiSchema(schema, { collaborative: true });
 * const final = mergeUiSchema(generated, {
 *   title: { 'ui:placeholder': 'Enter a title...' }
 * });
 * ```
 */
export function mergeUiSchema(
  generated: UiSchema,
  overrides: UiSchema,
): UiSchema {
  const result: UiSchema = { ...generated };

  for (const [key, value] of Object.entries(overrides)) {
    if (
      result[key] &&
      typeof result[key] === 'object' &&
      typeof value === 'object'
    ) {
      // Deep merge for field-level overrides
      result[key] = { ...result[key], ...value };
    } else {
      result[key] = value;
    }
  }

  return result;
}
