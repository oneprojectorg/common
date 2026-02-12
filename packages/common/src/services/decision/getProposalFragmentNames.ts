/**
 * Derives Y.Doc fragment names from a proposal template schema.
 *
 * The frontend stores each text-based field (short-text, long-text) as a
 * separate named fragment inside a single shared Y.Doc. The title field
 * always uses the fragment name `'title'`. Non-collaborative fields (money,
 * category) store scalar values in proposalData and have no fragment.
 *
 * When no template is provided, falls back to `['default']` for backward
 * compatibility with legacy single-fragment documents.
 */
export function getProposalFragmentNames(
  proposalTemplate: Record<string, unknown>,
): string[] {
  const properties = proposalTemplate.properties as
    | Record<string, Record<string, unknown>>
    | undefined;

  if (!properties || Object.keys(properties).length === 0) {
    return ['default'];
  }

  const fieldOrder = (proposalTemplate['x-field-order'] as string[]) ?? [];
  const fragments: string[] = [];
  const seen = new Set<string>();

  // Respect x-field-order first, then pick up any remaining properties
  const orderedKeys = [
    ...fieldOrder,
    ...Object.keys(properties).filter((k) => !fieldOrder.includes(k)),
  ];

  for (const key of orderedKeys) {
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const prop = properties[key];
    if (!prop) {
      continue;
    }

    const format = prop['x-format'] as string | undefined;

    // Only text-based fields produce collaborative fragments.
    // title is always a collaborative field (rendered as CollaborativeTitleField).
    // short-text and long-text are rendered as CollaborativeTextField.
    if (key === 'title' || format === 'short-text' || format === 'long-text') {
      fragments.push(key);
    }
  }

  return fragments.length > 0 ? fragments : ['default'];
}
