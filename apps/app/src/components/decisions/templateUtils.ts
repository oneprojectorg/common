/**
 * Shared JSON Schema template utilities.
 *
 * Provides generic, type-safe operations for templates that store their
 * properties in a JSON Schema `properties` object and maintain ordering
 * via a top-level `x-field-order` array. Both proposal and rubric
 * templates share this structure.
 *
 * Domain-specific logic (e.g. scored criteria, locked proposal fields)
 * lives in `rubricTemplate.ts` and `proposalTemplate.ts` respectively.
 */
import type { XFormatPropertySchema } from '@op/common/client';
import type { JSONSchema7 } from 'json-schema';

// ---------------------------------------------------------------------------
// Base template shape
// ---------------------------------------------------------------------------

/**
 * Minimal contract that both `ProposalTemplateSchema` and
 * `RubricTemplateSchema` satisfy. All shared utilities are generic
 * over this interface.
 */
export interface BaseTemplateSchema extends JSONSchema7 {
  [key: string]: unknown;
  properties?: Record<string, XFormatPropertySchema>;
  'x-field-order'?: string[];
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

/**
 * Type guard that narrows a `JSONSchema7Definition` (which is
 * `JSONSchema7 | boolean`) to `JSONSchema7`.
 */
export function isSchemaObject(
  entry: JSONSchema7 | boolean,
): entry is JSONSchema7 {
  return typeof entry !== 'boolean';
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

/** Returns the ordered list of property IDs in the template. */
export function getPropertyOrder<T extends BaseTemplateSchema>(
  template: T,
): string[] {
  return template['x-field-order'] ?? [];
}

/** Returns the raw JSON Schema for a single property. */
export function getPropertySchema<T extends BaseTemplateSchema>(
  template: T,
  propertyId: string,
): XFormatPropertySchema | undefined {
  return template.properties?.[propertyId];
}

/** Returns the `title` of a property, falling back to `''`. */
export function getPropertyLabel<T extends BaseTemplateSchema>(
  template: T,
  propertyId: string,
): string {
  return getPropertySchema(template, propertyId)?.title ?? '';
}

/** Returns the `description` of a property. */
export function getPropertyDescription<T extends BaseTemplateSchema>(
  template: T,
  propertyId: string,
): string | undefined {
  return getPropertySchema(template, propertyId)?.description;
}

/** Returns whether a property is listed in the `required` array. */
export function isPropertyRequired<T extends BaseTemplateSchema>(
  template: T,
  propertyId: string,
): boolean {
  return template.required?.includes(propertyId) ?? false;
}

// ---------------------------------------------------------------------------
// Immutable updater (internal building block)
// ---------------------------------------------------------------------------

/**
 * Update a single property's schema within a template. Returns the
 * template unchanged if the property doesn't exist.
 */
export function updateProperty<T extends BaseTemplateSchema>(
  template: T,
  propertyId: string,
  updater: (schema: XFormatPropertySchema) => XFormatPropertySchema,
): T {
  const schema = getPropertySchema(template, propertyId);
  if (!schema) {
    return template;
  }
  return {
    ...template,
    properties: {
      ...template.properties,
      [propertyId]: updater(schema),
    },
  };
}

// ---------------------------------------------------------------------------
// Immutable mutators
// ---------------------------------------------------------------------------

/** Add a property with the given schema and append it to the order. */
export function addProperty<T extends BaseTemplateSchema>(
  template: T,
  propertyId: string,
  schema: XFormatPropertySchema,
): T {
  const order = getPropertyOrder(template);
  return {
    ...template,
    properties: {
      ...template.properties,
      [propertyId]: schema,
    },
    'x-field-order': [...order, propertyId],
  };
}

/** Remove a property from the template, including from `required` and order. */
export function removeProperty<T extends BaseTemplateSchema>(
  template: T,
  propertyId: string,
): T {
  const { [propertyId]: _removed, ...restProps } = template.properties ?? {};
  const order = getPropertyOrder(template).filter((id) => id !== propertyId);
  const required = (template.required ?? []).filter((id) => id !== propertyId);

  return {
    ...template,
    properties: restProps,
    required: required.length > 0 ? required : undefined,
    'x-field-order': order,
  };
}

/** Replace the property order with the given array. */
export function reorderProperties<T extends BaseTemplateSchema>(
  template: T,
  newOrder: string[],
): T {
  return {
    ...template,
    'x-field-order': newOrder,
  };
}

/** Update the `title` of a property. */
export function updatePropertyLabel<T extends BaseTemplateSchema>(
  template: T,
  propertyId: string,
  label: string,
): T {
  return updateProperty(template, propertyId, (s) => ({ ...s, title: label }));
}

/** Update the `description` of a property. Removes the key when empty. */
export function updatePropertyDescription<T extends BaseTemplateSchema>(
  template: T,
  propertyId: string,
  description: string | undefined,
): T {
  return updateProperty(template, propertyId, (s) => {
    const updated = { ...s };
    if (description) {
      updated.description = description;
    } else {
      delete updated.description;
    }
    return updated;
  });
}

/** Set or unset a property as required. */
export function setPropertyRequired<T extends BaseTemplateSchema>(
  template: T,
  propertyId: string,
  required: boolean,
): T {
  const current = template.required ?? [];
  const filtered = current.filter((id) => id !== propertyId);
  const next = required ? [...filtered, propertyId] : filtered;

  return {
    ...template,
    required: next.length > 0 ? next : undefined,
  };
}
