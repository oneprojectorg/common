/**
 * Converts a category label to a taxonomy term URI slug.
 * Must stay in sync with how taxonomy terms are created in
 * ensureProposalTaxonomy (createProcess, updateProcess, updateInstance).
 */
export function toTermUri(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}
