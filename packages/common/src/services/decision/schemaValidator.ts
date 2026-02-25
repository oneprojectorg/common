import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { JSONSchema7 } from 'json-schema';

import { ValidationError } from '../../utils';

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
   * Validate proposal data against a proposal template schema
   * Throws ValidationError if validation fails
   */
  validateProposalData(
    proposalTemplate: JSONSchema7,
    proposalData: unknown,
  ): void {
    const result = this.validate(proposalTemplate, proposalData);

    if (!result.valid) {
      const errorMessage = Object.values(result.errors).join(', ');

      throw new ValidationError(
        `Proposal validation failed: ${errorMessage}`,
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
   * Get user-friendly display name for a field by looking up the `title`
   * property from the schema definition. Falls back to capitalizing the key.
   */
  private getFieldDisplayName(fieldName: string, schema?: JSONSchema7): string {
    const fieldSchema = schema?.properties?.[fieldName];
    if (typeof fieldSchema === 'object' && fieldSchema?.title) {
      return fieldSchema.title;
    }
    return fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
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
    const fieldName = fieldPath.split('.').pop() || '';
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
      default:
        return `${friendlyName} is invalid`;
    }
  }
}

// Export singleton instance
export const schemaValidator = new SchemaValidator();
