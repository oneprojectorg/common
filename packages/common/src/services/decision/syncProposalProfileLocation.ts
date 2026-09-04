import { type DbClient, eq, sql } from '@op/db/client';
import { locations, profilesLocations } from '@op/db/schema';

import { getPlaceCoordinates, normalizeLocation } from './proposalDataSchema';

/**
 * Projects `proposalData.location` ({ lat, lng }) onto the proposal's profile
 * via the shared `locations` / `profiles_locations` relation, rather than a
 * bespoke column on `decision_proposals`. Every entity in the system is a
 * profile, so this reuses the same mechanism organizations use for their
 * `whereWeWork` locations (see `createOrganization`).
 *
 * - Valid location → upsert a `locations` row keyed by the geocoded Google
 *   `placeId` (falling back to a deterministic synthetic id when reverse
 *   geocoding yielded none, e.g. a pin in open water) and (re)point the
 *   profile's single join at it.
 * - Absent/malformed location → remove any existing link.
 *
 * The `locations` row is deduplicated by place id and shared across every
 * proposal at that place, so it stores the *canonical place coordinate*
 * (`placeLat`/`placeLng`) — deterministic per place, so co-located proposals
 * write identical values rather than fighting over the row. Each proposal's
 * exact pin (`lat`/`lng`) stays in proposalData. When no geocoded place exists
 * we fall back to the pin for both the key and the coordinate.
 *
 * Because the key is a shared Google place id rather than a per-profile
 * synthetic, moving the pin lands on a different `locations` row — so we always
 * clear the profile's existing join first and re-insert, rather than upserting
 * the join in place.
 *
 * Never throws on a bad value — a malformed location degrades to "no link"
 * instead of failing the surrounding write. Must run inside the same
 * transaction as the proposal write (`tx`).
 */
export async function syncProposalProfileLocation(
  tx: DbClient,
  proposalProfileId: string,
  proposalData: Record<string, unknown> | null | undefined,
): Promise<void> {
  const location = normalizeLocation(proposalData?.location);

  // Clear any existing link up front so a moved pin re-points cleanly to the
  // (possibly different) location row below.
  await tx
    .delete(profilesLocations)
    .where(eq(profilesLocations.profileId, proposalProfileId));

  if (!location) {
    return;
  }

  const placeId = location.placeId ?? `proposal-location:${proposalProfileId}`;

  // Store the canonical place coordinate on the shared row, falling back to the
  // exact pin when there's no geocoded place.
  const { lat: placeLat, lng: placeLng } = getPlaceCoordinates(location);

  const [row] = await tx
    .insert(locations)
    .values({
      placeId,
      address: location.address,
      location: sql`ST_SetSRID(ST_MakePoint(${placeLng}, ${placeLat}), 4326)`,
    })
    .onConflictDoUpdate({
      target: [locations.placeId],
      set: {
        location: sql`excluded.location`,
        address: sql`excluded.address`,
      },
    })
    .returning();

  if (row) {
    await tx
      .insert(profilesLocations)
      .values({ profileId: proposalProfileId, locationId: row.id })
      .onConflictDoNothing();
  }
}
