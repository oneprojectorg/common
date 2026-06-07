import { normalizeLocation } from './proposalDataSchema';

/**
 * Projects the `location` value from proposalData into the shape expected by
 * the `proposals.location` geometry column (drizzle `mode: 'xy'`, SRID 4326):
 * `x` = longitude, `y` = latitude.
 *
 * Returns `null` when the location is absent or malformed — never throws, so
 * a bad value degrades to a NULL column instead of failing the write.
 */
export function proposalLocationToGeometry(
  proposalData: unknown,
): { x: number; y: number } | null {
  const raw =
    proposalData && typeof proposalData === 'object'
      ? (proposalData as Record<string, unknown>).location
      : undefined;

  const location = normalizeLocation(raw);

  if (!location) {
    return null;
  }

  return { x: location.lng, y: location.lat };
}
