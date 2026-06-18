import { describe, expect, it } from 'vitest';

import { relaxLocationCategoryRequirement } from './relaxLocationCategoryRequirement';
import type { ProposalTemplateSchema } from './types';

function template(options: {
  category?: 'single' | 'multi';
  withLocation?: boolean;
  required?: string[];
}): ProposalTemplateSchema {
  const { category, withLocation = true, required } = options;
  const properties: NonNullable<ProposalTemplateSchema['properties']> = {};

  if (withLocation) {
    properties.location = { type: 'object', 'x-format': 'location' };
  }
  if (category === 'single') {
    properties.category = { type: ['string', 'null'], 'x-format': 'dropdown' };
  } else if (category === 'multi') {
    properties.category = { type: 'array', 'x-format': 'dropdown', minItems: 1 };
  }

  return {
    type: 'object',
    properties,
    ...(required ? { required } : {}),
  };
}

describe('relaxLocationCategoryRequirement', () => {
  it('drops category from required for a location + single-select template', () => {
    const result = relaxLocationCategoryRequirement(
      template({ category: 'single', required: ['title', 'location', 'category'] }),
    );

    expect(result.required).toEqual(['title', 'location']);
  });

  it('drops both required and minItems for a location + multi-select template', () => {
    const result = relaxLocationCategoryRequirement(
      template({ category: 'multi', required: ['title', 'location', 'category'] }),
    );

    expect(result.required).toEqual(['title', 'location']);
    expect(result.properties?.category?.minItems).toBeUndefined();
  });

  it('preserves the category options so a picked value still validates', () => {
    const input = template({ category: 'multi', required: ['category'] });
    input.properties!.category = {
      type: 'array',
      'x-format': 'dropdown',
      items: { type: 'string', oneOf: [{ const: 'District 7' }] },
      minItems: 1,
    };

    const result = relaxLocationCategoryRequirement(input);

    expect(result.properties?.category?.items).toEqual({
      type: 'string',
      oneOf: [{ const: 'District 7' }],
    });
  });

  it('returns the template unchanged when it collects no location', () => {
    const input = template({
      category: 'single',
      withLocation: false,
      required: ['title', 'category'],
    });

    const result = relaxLocationCategoryRequirement(input);

    expect(result).toBe(input);
    expect(result.required).toEqual(['title', 'category']);
  });

  it('returns the template unchanged when it has no category field', () => {
    const input = template({ required: ['title', 'location'] });

    expect(relaxLocationCategoryRequirement(input)).toBe(input);
  });

  it('does not mutate the input template', () => {
    const input = template({
      category: 'multi',
      required: ['title', 'location', 'category'],
    });

    relaxLocationCategoryRequirement(input);

    expect(input.required).toEqual(['title', 'location', 'category']);
    expect(input.properties?.category?.minItems).toBe(1);
  });
});
