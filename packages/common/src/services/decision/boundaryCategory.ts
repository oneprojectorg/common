import { logger } from '@op/logging';

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
    logger.error('Error resolving boundary category', { error });
    return null;
  }
}

/**
 * Replaces any prior district category label with the location's new one. Strips
 * every label in the profile's boundary set before appending the resolved
 * district, so a pin moved into a different district doesn't leave the previous
 * district tagged alongside the new one. The strip also fires when the pin is
 * cleared or falls outside every boundary, so a stale district label never
 * outlives the location it was derived from. No-op (returns the input
 * reference) when the profile has no boundaries — nothing to strip and nothing
 * to add. Queries run in parallel so the common with-district write path adds
 * no serial latency over the previous single-query implementation.
 */
export async function withBoundaryCategoryLabel(
  labels: string[],
  proposalData: unknown,
  { profileId }: { profileId: string },
): Promise<string[]> {
  const [districtLabel, boundaryLabels] = await Promise.all([
    resolveBoundaryCategoryLabel(proposalData, { profileId }),
    listBoundaryLabels({ profileId }),
  ]);

  if (boundaryLabels.size === 0) {
    return labels;
  }

  return replaceDistrictLabel(labels, districtLabel, boundaryLabels);
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

  if (schemaAllowsMultipleSelection(categorySchema)) {
    const existing = normalizeProposalCategories(data.category);
    const [districtLabel, boundaryLabels] = await Promise.all([
      resolveBoundaryCategoryLabel(data, { profileId }),
      listBoundaryLabels({ profileId }),
    ]);

    if (boundaryLabels.size === 0) {
      return data;
    }

    return {
      ...data,
      category: replaceDistrictLabel(existing, districtLabel, boundaryLabels),
    };
  }

  // Single-select: only one value can ever hold; replace when a new district
  // resolves, leave untouched otherwise. Stale-label cleanup for the
  // pin-cleared single-select case isn't covered by this fix — only multi-
  // select could exhibit the "both districts tagged" symptom this PR targets.
  const districtLabel = await resolveBoundaryCategoryLabel(data, { profileId });

  if (!districtLabel) {
    return data;
  }

  return { ...data, category: districtLabel };
}

/**
 * Strips every label in the profile's boundary set from `labels` and appends
 * the resolved `districtLabel` (if any, and not already present). The shared
 * tail of `withBoundaryCategoryLabel` and the multi-select branch of
 * `fillCategoryFromBoundary`. Assumes the caller has already short-circuited
 * the empty-boundary-set case.
 */
function replaceDistrictLabel(
  labels: string[],
  districtLabel: string | null,
  boundaryLabels: Set<string>,
): string[] {
  const stripped = labels.filter((label) => !boundaryLabels.has(label));

  if (!districtLabel || stripped.includes(districtLabel)) {
    return stripped;
  }

  return [...stripped, districtLabel];
}
