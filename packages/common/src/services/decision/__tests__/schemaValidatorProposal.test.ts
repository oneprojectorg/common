import { describe, expect, it } from 'vitest';
import type { JSONSchema7 } from 'json-schema';

import { schemaValidator } from '../schemaValidator';
import { ValidationError } from '../../../utils';

describe('SchemaValidator - Proposal Validation', () => {
  const proposalSchema: JSONSchema7 = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      budget: { type: 'number', maximum: 5000 },
      category: { type: 'string', enum: ['tech', 'community'] },
    },
    required: ['title', 'description', 'budget'],
  };

  it('should throw ValidationError with proper field errors for missing budget', () => {
    const proposalData = {
      title: 'Test Proposal',
      description: 'This is a test',
      // budget is missing
    };

    expect(() => {
      schemaValidator.validateProposalData(proposalSchema, proposalData);
    }).toThrow(ValidationError);

    try {
      schemaValidator.validateProposalData(proposalSchema, proposalData);
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const validationError = error as ValidationError;
      expect(validationError.message).toContain('budget: Budget is required');
      expect(validationError.fieldErrors).toEqual({
        budget: 'Budget is required',
      });
    }
  });

  it('should throw ValidationError for budget over maximum', () => {
    const proposalData = {
      title: 'Test Proposal',
      description: 'This is a test',
      budget: 10000, // Over the 5000 maximum
    };

    try {
      schemaValidator.validateProposalData(proposalSchema, proposalData);
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const validationError = error as ValidationError;
      expect(validationError.message).toContain('budget: Budget cannot exceed 5000');
      expect(validationError.fieldErrors).toEqual({
        budget: 'Budget cannot exceed 5000',
      });
    }
  });

  it('should not throw for valid proposal data', () => {
    const proposalData = {
      title: 'Test Proposal',
      description: 'This is a test',
      budget: 3000,
      category: 'tech',
    };

    expect(() => {
      schemaValidator.validateProposalData(proposalSchema, proposalData);
    }).not.toThrow();
  });
});