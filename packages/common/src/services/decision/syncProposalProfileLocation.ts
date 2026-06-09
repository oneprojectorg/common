import { type DbClient, eq, sql } from '@op/db/client';
import { locations, profilesLocations } from '@op/db/schema';

import { normalizeLocation } from './proposalDataSchema';

/**
 * Projects `proposalData.location` ({ lat, lng }) onto the proposal's profile
 * via the shared `locations` / `profiles_locations` relation, rather than a
 * bespoke column on `decision_proposals`. Every entity in the system is a
 * profile, so this reuses the same mechanism organizations use for their
 * `whereWeWork` locations (see `createOrganization`).
 *
 * - Valid location → upsert a single `locations` row keyed by a deterministic
 *   synthetic `placeId` (raw lat/lng have no Google place id yet) and ensure
 *   the join row exists. The upsert keeps one row per proposal profile, so
 *   frequent autosaves don't accumulate orphaned location rows.
 * - Absent/malformed location → remove any existing link.
 *
 * Never throws on a bad value — a malformed location degrades to "no link"
 * instead of failing the surrounding write. Must run inside the same
 * transaction as the proposal write (`tx`).
 */
export async function syncProposalProfileLocation(
  tx: DbClient,
  proposalProfileId: string,
  proposalData: unknown,
): Promise<void> {
  const raw =
    proposalData && typeof proposalData === 'object'
      ? (proposalData as Record<string, unknown>).location
      : undefined;

  const location = normalizeLocation(raw);

  if (!location) {
    await tx
      .delete(profilesLocations)
      .where(eq(profilesLocations.profileId, proposalProfileId));
    return;
  }

  const placeId = `proposal-location:${proposalProfileId}`;

  const [row] = await tx
    .insert(locations)
    .values({
      placeId,
      address: location.address,
      location: sql`ST_SetSRID(ST_MakePoint(${location.lng}, ${location.lat}), 4326)`,
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
