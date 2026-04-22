import slugify from 'slugify';

/**
 * Converts a category label to a taxonomy term URI.
 * Must be used consistently across all write (ensureProposalTaxonomyTerms)
 * and read (getProcessCategories) paths.
 */
export function toTermUri(label: string): string {
  return slugify(label, { lower: true, strict: true, trim: true });
}
