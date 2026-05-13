import { describe, expect, it } from 'vitest';

import { normalizeProposalTemplate } from './normalizeProposalTemplate';
import type { ProposalTemplateSchema } from './types';

describe('normalizeProposalTemplate', () => {
  it('rewrites legacy numeric budget into the canonical money object shape', () => {
    const legacy: ProposalTemplateSchema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
        budget: { type: 'number', maximum: 100000 },
      },
      required: ['title', 'budget'],
    };

    const result = normalizeProposalTemplate(legacy);

    expect(result.properties?.budget).toEqual({
      type: 'object',
      'x-format': 'money',
      title: 'Budget',
      properties: {
        amount: { type: 'number', maximum: 100000 },
        currency: { type: 'string', default: 'USD' },
      },
      required: ['amount'],
    });
    // Top-level required must be preserved verbatim — the field is still 'budget'.
    expect(result.required).toEqual(['title', 'budget']);
  });

  it('moves minimum, default, and description onto the inner amount', () => {
    const legacy: ProposalTemplateSchema = {
      type: 'object',
      properties: {
        budget: {
          type: 'number',
          minimum: 0,
          default: 500,
          description: 'Requested amount',
          title: 'Requested budget',
        },
      },
    };

    const result = normalizeProposalTemplate(legacy);
    const budget = result.properties?.budget;

    expect(budget).toMatchObject({
      type: 'object',
      'x-format': 'money',
      title: 'Requested budget',
      description: 'Requested amount',
      properties: {
        amount: { type: 'number', minimum: 0, default: 500 },
      },
    });
  });

  it('leaves canonical money-shape budget schemas untouched', () => {
    const canonical: ProposalTemplateSchema = {
      type: 'object',
      properties: {
        budget: {
          type: 'object',
          'x-format': 'money',
          properties: {
            amount: { type: 'number', maximum: 50000 },
            currency: { type: 'string', default: 'USD' },
          },
        },
      },
    };

    // Identity — no rewrite triggered, same reference returned.
    expect(normalizeProposalTemplate(canonical)).toBe(canonical);
  });

  it('leaves templates without a budget field untouched', () => {
    const template: ProposalTemplateSchema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
        summary: { type: 'string' },
      },
    };

    expect(normalizeProposalTemplate(template)).toBe(template);
  });

  it('leaves templates without properties untouched', () => {
    const template: ProposalTemplateSchema = { type: 'object' };
    expect(normalizeProposalTemplate(template)).toBe(template);
  });

  it('does not rewrite a budget field whose x-format is already set', () => {
    // Defensive: any future x-format we have not coded a normalizer for
    // (e.g. hours, points) must pass through unchanged.
    const template: ProposalTemplateSchema = {
      type: 'object',
      properties: {
        budget: {
          type: 'number',
          'x-format': 'money',
          maximum: 1000,
        },
      },
    };

    expect(normalizeProposalTemplate(template)).toBe(template);
  });
});
