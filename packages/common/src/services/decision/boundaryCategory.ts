import {
  normalizeLocation,
  normalizeProposalCategories,
  schemaAllowsMultipleSelection,
} from './proposalDataSchema';
import { resolveBoundary } from './resolveBoundary';
import { templateCollectsLocation } from './templateLocation';
import type { ProposalTemplateSchema } from './types';

/**
 * Resolves the council-district category **label** for a proposal's location:
 * the boundary whose polygon contains the pin, when that boundary is linked to a
 * category. `boundary.name` is the category label (see `importBoundaries.sql`).
 *
 * Returns `null` when there is no location, no containing boundary, or the
 * boundary has no linked category. Never throws — a boundary lookup failure must
 * not fail the surrounding proposal write.
 */
export async function resolveBoundaryCategoryLabel(
  proposalData: unknown,
): Promise<string | null> {
  try {
    const raw =
      proposalData && typeof proposalData === 'object'
        ? (proposalData as Record<string, unknown>).location
        : undefined;

    const location = normalizeLocation(raw);

    if (!location) {
      return null;
    }

    const boundary = await resolveBoundary({
      lat: location.lat,
      lng: location.lng,
    });

    return boundary?.taxonomyTermId ? boundary.name : null;
  } catch (error) {
    console.error('Error resolving boundary category:', error);
    return null;
  }
}

/**
 * Appends the location's district category label to a list of category labels
 * (deduplicated), so the boundary-derived category flows through the normal
 * category link. Returns the list unchanged when no district resolves.
 */
export async function withBoundaryCategoryLabel(
  labels: string[],
  proposalData: unknown,
): Promise<string[]> {
  const districtLabel = await resolveBoundaryCategoryLabel(proposalData);

  if (!districtLabel || labels.includes(districtLabel)) {
    return labels;
  }

  return [...labels, districtLabel];
}

/**
 * Fills the boundary-derived district category into to-be-validated proposal
 * data before schema validation — the server-side replacement for the former
 * client-side auto-select. No-op unless the template collects a location and has
 * a category field. Single/multi-select aware so the right shape validates.
 */
export async function fillCategoryFromBoundary(
  template: ProposalTemplateSchema,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const categorySchema = template.properties?.category;

  if (!templateCollectsLocation(template) || !categorySchema) {
    return data;
  }

  const districtLabel = await resolveBoundaryCategoryLabel(data);

  if (!districtLabel) {
    return data;
  }

  if (schemaAllowsMultipleSelection(categorySchema)) {
    const existing = normalizeProposalCategories(data.category);

    if (existing.includes(districtLabel)) {
      return data;
    }

    return { ...data, category: [...existing, districtLabel] };
  }

  return { ...data, category: districtLabel };
}
