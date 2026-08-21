import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { JSONSchema7 } from 'json-schema';

import { ValidationError } from '../../utils';
import { getSchemaFieldTitle } from './proposalDataSchema';

export interface SchemaValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * JSON Schema validator service using AJV
 * Provides validation for proposal data against process schema templates
 */
export class SchemaValidator {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true, // Return all validation errors, not just the first
      removeAdditional: false, // Keep additional properties
      useDefaults: false, // Don't modify data with defaults
      coerceTypes: false, // Don't coerce types automatically
    });

    // Add format support (date, email, etc.)
    addFormats(this.ajv);

    // Register vendor extension keywords used in proposal templates
    // so Ajv's strict mode doesn't reject them during schema compilation
    this.ajv.addKeyword('x-field-order');
    this.ajv.addKeyword('x-format');
    this.ajv.addKeyword('x-map-default');
    // Phase designation on custom forms (see CustomFormDefinitionSchema).
    this.ajv.addKeyword('x-phase');
  }

  /**
   * Validates that a value is a compilable JSON Schema (including vendor
   * extensions like x-field-order and x-format registered on this instance).
   * @throws ValidationError if the schema cannot be compiled
   */
  validateJsonSchema(schema: Record<string, unknown>): void {
    try {
      this.ajv.compile(schema as JSONSchema7);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown schema error';
      throw new ValidationError(`Invalid JSON Schema: ${message}`, {
        schema: message,
      });
    }
  }

  /**
   * Validate data against a JSON Schema
   */
  validate(schema: JSONSchema7, data: unknown): SchemaValidationResult {
    const validate = this.ajv.compile(schema);
    const valid = validate(data);

    if (valid) {
      return { valid: true, errors: {} };
    }

    const errors: Record<string, string> = {};
    const requiredErrors = new Set<string>();

    // First pass: collect required field errors
    for (const error of validate.errors || []) {
      if (error.keyword === 'required') {
        const missingProperty = error.params?.missingProperty;
        if (missingProperty) {
          const fieldPath = error.instancePath
            ? `${error.instancePath.substring(1)}.${missingProperty}`.replace(
                /^\./,
                '',
              )
            : missingProperty;
          requiredErrors.add(fieldPath);
          const friendlyName = this.getFieldDisplayName(
            missingProperty,
            schema,
          );
          errors[fieldPath] = `${friendlyName} is required`;
        }
      }
    }

    // Second pass: add other errors, but skip type errors for required fields
    for (const error of validate.errors || []) {
      if (error.keyword === 'required') {
        continue; // Already handled above
      }

      const field = this.getFieldPath(error.instancePath, error.keyword);

      // Skip type errors for fields that have required errors
      if (error.keyword === 'type' && requiredErrors.has(field)) {
        continue;
      }

      // Only add if we don't already have an error for this field
      if (!errors[field]) {
        errors[field] = this.formatErrorMessage(error, schema);
      }
    }

    return { valid: false, errors };
  }

  /**
   * Validate proposal data against a proposal template schema.
   * Throws ValidationError if validation fails.
   */
  assertProposalData(
    proposalTemplate: JSONSchema7,
    proposalData: unknown,
  ): void {
    this.validateDataOrThrow(proposalTemplate, proposalData, 'Proposal');
  }

  /**
   * Validate rubric data against a rubric template schema.
   * Throws ValidationError if validation fails.
   */
  assertRubricData(rubricTemplate: JSONSchema7, rubricData: unknown): void {
    this.validateDataOrThrow(rubricTemplate, rubricData, 'Rubric');
  }

  /**
   * Coerce top-level data values to match schema-declared types.
   *
   * Handles the array ↔ scalar mismatch that arises when stored data
   * migrates between single-value and multi-value formats while older
   * template schemas remain unchanged (e.g. category: string → string[]).
   */
  coerceToSchema(
    schema: JSONSchema7,
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!schema.properties) {
      return data;
    }

    const coerced = { ...data };

    for (const [key, value] of Object.entries(coerced)) {
      if (value === undefined || value === null) {
        continue;
      }

      const propSchema = schema.properties[key];
      if (!propSchema || typeof propSchema !== 'object') {
        continue;
      }

      const types = Array.isArray(propSchema.type)
        ? propSchema.type
        : propSchema.type
          ? [propSchema.type]
          : [];

      const expectsArray = types.includes('array');
      const expectsScalar =
        types.includes('string') ||
        types.includes('number') ||
        types.includes('integer') ||
        types.includes('null');

      if (expectsArray && !Array.isArray(value)) {
        coerced[key] = [value];
      } else if (!expectsArray && expectsScalar && Array.isArray(value)) {
        coerced[key] = value[0] ?? null;
      }
    }

    return coerced;
  }

  /**
   * Shared helper: validate data against a schema, throwing a
   * labelled ValidationError on failure.
   */
  private validateDataOrThrow(
    schema: JSONSchema7,
    data: unknown,
    label: string,
  ): void {
    const coerced =
      data && typeof data === 'object' && !Array.isArray(data)
        ? this.coerceToSchema(schema, data as Record<string, unknown>)
        : data;
    const result = this.validate(schema, coerced);

    if (!result.valid) {
      const errorMessage = Object.values(result.errors).join(', ');

      throw new ValidationError(
        `${label} validation failed: ${errorMessage}`,
        result.errors,
      );
    }
  }

  /**
   * Get human-readable field path from AJV error
   */
  private getFieldPath(instancePath: string, keyword: string): string {
    if (!instancePath) {
      return keyword === 'required' ? 'required fields' : 'root';
    }

    // Convert from JSON pointer format (/field/subfield) to dot notation
    return instancePath.split('/').filter(Boolean).join('.');
  }

  /**
   * The property an error belongs to, ignoring array indices.
   *
   * AJV reports a failing array element at `/category/0`, so taking the last
   * path segment yields `0` — an index, not a field. That has no entry in
   * `properties`, so the display name fell through to the index itself and the
   * message read "0 is invalid", naming neither the field nor the problem.
   * Walking back to the last non-numeric segment recovers the owning property.
   */
  private getOwningFieldName(instancePath: string): string {
    const segments = instancePath.split('/').filter(Boolean);

    for (let i = segments.length - 1; i >= 0; i--) {
      const segment = segments[i];
      if (segment && !/^\d+$/.test(segment)) {
        return segment;
      }
    }

    return '';
  }

  /**
   * Get user-friendly display name for a field by looking up the `title`
   * property from the schema definition. Falls back to capitalizing the key.
   */
  private getFieldDisplayName(fieldName: string, schema?: JSONSchema7): string {
    const fieldSchema = schema?.properties?.[fieldName];
    return getSchemaFieldTitle(
      typeof fieldSchema === 'object' ? fieldSchema : undefined,
      fieldName,
    );
  }

  /**
   * Format AJV error message for better UX
   */
  private formatErrorMessage(
    error: {
      keyword: string;
      instancePath: string;
      params?: Record<string, unknown>;
    },
    schema?: JSONSchema7,
  ): string {
    const fieldPath = this.getFieldPath(error.instancePath, error.keyword);
    const fieldName =
      this.getOwningFieldName(error.instancePath) ||
      fieldPath.split('.').pop() ||
      '';
    const friendlyName = this.getFieldDisplayName(fieldName, schema);

    switch (error.keyword) {
      case 'required':
        return `${friendlyName} is required`;
      case 'type':
        if (error.params?.type === 'number') {
          return `${friendlyName} must be a number`;
        }
        if (error.params?.type === 'string') {
          return `${friendlyName} must be text`;
        }
        return `${friendlyName} has an invalid format`;
      case 'minimum':
        return `${friendlyName} must be at least ${Number(error.params?.limit).toLocaleString()}`;
      case 'maximum':
        return `${friendlyName} cannot exceed ${Number(error.params?.limit).toLocaleString()}`;
      case 'minLength':
        return `${friendlyName} must be at least ${error.params?.limit} characters`;
      case 'maxLength':
        return `${friendlyName} cannot exceed ${error.params?.limit} characters`;
      case 'enum': {
        const allowed = error.params?.allowedValues;
        const values = Array.isArray(allowed) ? allowed.join(', ') : '';
        return `${friendlyName} must be one of: ${values}`;
      }
      case 'format':
        return `${friendlyName} has an invalid ${error.params?.format} format`;
      case 'oneOf':
      case 'const': {
        // A selection is matched against one `oneOf` branch per configured
        // option. AJV reports which branches matched in `passingSchemas`:
        // absent means none did (the ordinary invalid-selection case), while
        // two or more means the value was ambiguous — the options themselves
        // carry duplicate values, so `oneOf`'s "exactly one" cannot hold.
        //
        // That distinction matters because the second case is not the
        // submitter's mistake and they cannot resolve it by choosing again:
        // every proposal picking that option fails until the duplicate is
        // removed. Saying "invalid" there sends them to re-pick a value that
        // can never validate.
        const passingSchemas = error.params?.passingSchemas;

        if (Array.isArray(passingSchemas) && passingSchemas.length > 1) {
          return `${friendlyName} has duplicate options configured, so this selection is ambiguous — an administrator needs to remove the duplicate`;
        }

        return `${friendlyName} has an invalid selection`;
      }
      case 'uniqueItems':
        return `${friendlyName} cannot contain the same selection twice`;
      default:
        return `${friendlyName} is invalid`;
    }
  }
}

// Export singleton instance
export const schemaValidator = new SchemaValidator();
