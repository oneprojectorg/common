import type { JSONSchema7 } from 'json-schema';
import { describe, expect, it } from 'vitest';

import { schemaValidator } from '../schemaValidator';

describe('SchemaValidator', () => {
  const testSchema: JSONSchema7 = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      budget: { type: 'number' },
    },
    required: ['title', 'description', 'budget'],
  };

  it('should prioritize required errors over type errors', () => {
    const testData = {
      title: 'Test Proposal',
      description: 'This is a test',
      budget: undefined, // This should trigger a required error, not a type error
    };

    const result = schemaValidator.validate(testSchema, testData);

    expect(result.valid).toBe(false);
    expect(result.errors.budget).toBe('Budget is required');
    expect(result.errors.budget).not.toContain('Expected number');
  });

  it('should show required error for missing fields', () => {
    const testData = {
      title: 'Test Proposal',
      description: 'This is a test',
      // budget is completely missing
    };

    const result = schemaValidator.validate(testSchema, testData);

    expect(result.valid).toBe(false);
    expect(result.errors.budget).toBe('Budget is required');
  });

  it('should show type error for wrong type when field is present', () => {
    const testData = {
      title: 'Test Proposal',
      description: 'This is a test',
      budget: 'not a number', // Wrong type but not missing
    };

    const result = schemaValidator.validate(testSchema, testData);

    expect(result.valid).toBe(false);
    expect(result.errors.budget).toBe('Budget must be a number');
  });

  it('should show multiple required errors', () => {
    const testData = {
      // Missing title, description, and budget
    };

    const result = schemaValidator.validate(testSchema, testData);

    expect(result.valid).toBe(false);
    expect(result.errors.title).toBe('Title is required');
    expect(result.errors.description).toBe('Description is required');
    expect(result.errors.budget).toBe('Budget is required');
  });

  it('should validate successfully for correct data', () => {
    const testData = {
      title: 'Test Proposal',
      description: 'This is a test',
      budget: 1000,
    };

    const result = schemaValidator.validate(testSchema, testData);

    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });
});
