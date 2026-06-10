import type { LngLat } from '@op/ui/Map';

/**
 * A closed ring of `[lng, lat]` vertices. Set {@link DEV_TEST_AREA} to one to
 * exercise the out-of-area error state locally.
 */
type Ring = ReadonlyArray<readonly [number, number]>;

/**
 * Optional dev-only boundary. `null` in normal operation → every point is
 * in-area. Drop a polygon here to verify the out-of-area UI until the real
 * project-area backend exists (see TBD in the plan).
 */
const DEV_TEST_AREA: Ring | null = null;

/** Standard ray-casting point-in-polygon test. */
function isPointInRing(point: LngLat, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Whether a placed point falls within the decision's valid project area.
 *
 * STUB: no project-area boundary is persisted yet (storage is TBD). With no
 * {@link DEV_TEST_AREA} configured this always reports in-area, so the picker
 * never blocks. When the boundary backend lands, replace the body with a real
 * check (e.g. a tRPC `ST_Contains` query keyed by the process instance) — the
 * call site and the out-of-area UI are already wired.
 */
export function useProjectAreaCheck(point: LngLat | null): {
  isWithinArea: boolean;
} {
  if (!point || !DEV_TEST_AREA) {
    return { isWithinArea: true };
  }

  return { isWithinArea: isPointInRing(point, DEV_TEST_AREA) };
}
