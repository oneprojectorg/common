import type { ProposalTemplateSchema } from './types';

/** Property keys that get special UI treatment (rendered in the header, not as dynamic fields). */
export const SYSTEM_FIELD_KEYS = new Set(['title', 'budget', 'category']);

export interface ProposalTemplateFieldOrder {
  system: string[];
  rest: string[];
  all: string[];
}

/**
 * Returns template field keys partitioned into system and user-defined,
 * ordered by: system fields first (title, budget, category if present),
 * then `x-field-order`, then any remaining properties.
 */
export function getProposalTemplateFieldOrder(
  proposalTemplate: ProposalTemplateSchema,
): ProposalTemplateFieldOrder {
  const empty: ProposalTemplateFieldOrder = {
    system: [],
    rest: [],
    all: [],
  };

  const properties = proposalTemplate.properties;

  if (!properties || Object.keys(properties).length === 0) {
    return empty;
  }

  const fieldOrder = proposalTemplate['x-field-order'] ?? [];

  const seen = new Set<string>();
  const system: string[] = [];
  const rest: string[] = [];

  for (const key of SYSTEM_FIELD_KEYS) {
    if (seen.has(key) || !properties[key]) {
      continue;
    }
    seen.add(key);
    system.push(key);
  }

  const orderedKeys = [
    ...fieldOrder,
    ...Object.keys(properties).filter((k) => !fieldOrder.includes(k)),
  ];

  for (const key of orderedKeys) {
    if (seen.has(key) || !properties[key]) {
      continue;
    }
    seen.add(key);
    rest.push(key);
  }

  return {
    system,
    rest,
    all: [...system, ...rest],
  };
}
