import { templateCollectsLocation } from './templateLocation';
import type { ProposalTemplateSchema } from './types';

/**
 * Client validation only: for a location-collecting template the category is
 * auto-derived from the pin's council district on the server
 * (`fillCategoryFromBoundary`). So the client must not block submit on a missing
 * category — it would be enforcing a value the user never supplies.
 *
 * Returns a relaxed copy with `category` removed from `required` and the
 * multi-select `minItems` dropped; category *validity* (the `oneOf` options) is
 * preserved, so a value the user did pick is still validated. Templates that do
 * not collect a location, or have no category field, are returned unchanged so
 * manual-category processes keep enforcing the requirement. Never mutates the
 * input — the original template is still used to render fields and build the
 * submit payload.
 */
export function relaxLocationCategoryRequirement(
  template: ProposalTemplateSchema,
): ProposalTemplateSchema {
  const categorySchema = template.properties?.category;

  if (!templateCollectsLocation(template) || !categorySchema) {
    return template;
  }

  const relaxedCategory = { ...categorySchema };
  delete relaxedCategory.minItems;

  return {
    ...template,
    required: (template.required ?? []).filter((key) => key !== 'category'),
    properties: { ...template.properties, category: relaxedCategory },
  };
}
