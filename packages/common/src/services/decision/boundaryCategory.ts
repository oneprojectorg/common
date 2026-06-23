import {
  normalizeLocation,
  normalizeProposalCategories,
  schemaAllowsMultipleSelection,
} from './proposalDataSchema';
import { listBoundaryLabels, resolveBoundary } from './resolveBoundary';
import { templateCollectsLocation } from './templateLocation';
import type { ProposalTemplateSchema } from './types';

/**
 * Resolves the council-district category **label** for a proposal's location:
 * the boundary whose polygon contains the pin within the given decision
 * profile, when that boundary is linked to a category. `boundary.name` is the
 * category label (see `importBoundaries.sql`).
 *
 * Returns `null` when there is no location, no containing boundary in this
 * profile's set, or the boundary has no linked category. Never throws — a
 * boundary lookup failure must not fail the surrounding proposal write.
 */
export async function resolveBoundaryCategoryLabel(
  proposalData: unknown,
  { profileId }: { profileId: string },
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
      profileId,
    });

    return boundary?.taxonomyTermId ? boundary.name : null;
  } catch (error) {
    console.error('Error resolving boundary category:', error);
    return null;
  }
}

/**
 * Replaces any prior district category label with the location's new one. Strips
 * every label in the profile's boundary set before appending the resolved
 * district, so a pin moved into a different district doesn't leave the previous
 * district tagged alongside the new one. Returns the list unchanged when no
 * district resolves in the given profile's boundary set.
 */
export async function withBoundaryCategoryLabel(
  labels: string[],
  proposalData: unknown,
  { profileId }: { profileId: string },
): Promise<string[]> {
  const districtLabel = await resolveBoundaryCategoryLabel(proposalData, {
    profileId,
  });

  if (!districtLabel) {
    return labels;
  }

  const boundaryLabels = await listBoundaryLabels({ profileId });
  const withoutStaleDistricts = labels.filter(
    (label) => !boundaryLabels.has(label),
  );

  if (withoutStaleDistricts.includes(districtLabel)) {
    return withoutStaleDistricts;
  }

  return [...withoutStaleDistricts, districtLabel];
}

/**
 * Fills the boundary-derived district category into to-be-validated proposal
 * data before schema validation — the server-side replacement for the former
 * client-side auto-select. No-op unless the template collects a location and
 * has a category field. Single/multi-select aware so the right shape
 * validates. Scoped to the proposal's decision profile.
 */
export async function fillCategoryFromBoundary(
  template: ProposalTemplateSchema,
  data: Record<string, unknown>,
  { profileId }: { profileId: string },
): Promise<Record<string, unknown>> {
  const categorySchema = template.properties?.category;

  if (!templateCollectsLocation(template) || !categorySchema) {
    return data;
  }

  const districtLabel = await resolveBoundaryCategoryLabel(data, { profileId });

  if (!districtLabel) {
    return data;
  }

  if (schemaAllowsMultipleSelection(categorySchema)) {
    const existing = normalizeProposalCategories(data.category);
    const boundaryLabels = await listBoundaryLabels({ profileId });
    const withoutStaleDistricts = existing.filter(
      (label) => !boundaryLabels.has(label),
    );

    if (withoutStaleDistricts.includes(districtLabel)) {
      return { ...data, category: withoutStaleDistricts };
    }

    return { ...data, category: [...withoutStaleDistricts, districtLabel] };
  }

  return { ...data, category: districtLabel };
}
