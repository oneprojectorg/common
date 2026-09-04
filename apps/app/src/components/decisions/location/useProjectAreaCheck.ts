import { trpc } from '@op/api/client';
import type { LngLat } from '@op/sense/Map';

interface ProjectAreaCheck {
  /** True while no point is set, while resolving, or when inside a boundary. */
  isWithinArea: boolean;
  /** True while the boundary lookup for the current point is in flight. */
  isResolving: boolean;
}

/**
 * Resolves a placed point against the persisted boundaries owned by the given
 * decision profile (`ST_Contains` on the server) to tell whether it falls
 * inside a valid project area. Used by the editable picker to flag out-of-area
 * placements before submit.
 *
 * No point, no decision profile, or a still-resolving lookup reports in-area so
 * the picker never flashes an error prematurely. A settled result marks the
 * point out-of-area only when boundaries are actually configured for the
 * profile — with no boundaries (or no profile), every point is in-area (the
 * pin can go anywhere).
 */
export function useProjectAreaCheck(
  point: LngLat | null,
  profileId: string | null,
): ProjectAreaCheck {
  const enabled = point != null && profileId != null;

  const query = trpc.decision.resolveBoundary.useQuery(
    {
      lat: point?.lat ?? 0,
      lng: point?.lng ?? 0,
      profileId: profileId ?? '',
    },
    { enabled, staleTime: 60_000 },
  );

  const isResolving = enabled && query.isFetching;
  const hasResult = enabled && query.isSuccess && !query.isFetching;
  const boundary = query.data?.boundary ?? null;
  const boundariesConfigured = query.data?.boundariesConfigured ?? false;

  return {
    isWithinArea: !hasResult || boundary != null || !boundariesConfigured,
    isResolving,
  };
}
