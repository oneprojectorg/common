import { describe, expect, it } from 'vitest';

import { templateCollectsLocation } from './templateLocation';
import type { ProposalTemplateSchema } from './types';

describe('templateCollectsLocation', () => {
  it('returns true when a property has the location x-format', () => {
    const template: ProposalTemplateSchema = {
      type: 'object',
      properties: {
        title: { type: 'string', 'x-format': 'short-text' },
        where: { type: 'object', 'x-format': 'location' },
      },
    };

    expect(templateCollectsLocation(template)).toBe(true);
  });

  it('returns false when no property collects a location', () => {
    const template: ProposalTemplateSchema = {
      type: 'object',
      properties: {
        title: { type: 'string', 'x-format': 'short-text' },
        budget: { type: 'object', 'x-format': 'money' },
      },
    };

    expect(templateCollectsLocation(template)).toBe(false);
  });

  it('returns false for null/empty templates', () => {
    expect(templateCollectsLocation(null)).toBe(false);
    expect(templateCollectsLocation(undefined)).toBe(false);
    expect(templateCollectsLocation({ type: 'object' })).toBe(false);
  });
});
