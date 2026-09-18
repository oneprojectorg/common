import type { XFormatPropertySchema } from '@op/common/client';

import { schemaHasOptions } from '../proposalTemplate';

/**
 * The category field is optional metadata: only present when the template's
 * `category` property has selectable options, and only sent when the author
 * picked at least one. Both an option-less template and an empty selection
 * must clear the field rather than send `[]`.
 */
export function resolveProposalCategory(
  categorySchema: XFormatPropertySchema | undefined,
  category: string[],
): string[] | undefined {
  const hasCategories =
    typeof categorySchema === 'object' && schemaHasOptions(categorySchema);

  if (!hasCategories) {
    return undefined;
  }

  return category.length > 0 ? category : undefined;
}
