import { db, sql } from '@op/db/client';
import { decisionBoundaries } from '@op/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Position is `[lng, lat]` (GeoJSON axis order, RFC 7946). The boundary geometry
 * is stored in PostGIS as `geometry(MultiPolygon, 4326)` and emitted via
 * `ST_AsGeoJSON`, so the shape is always a MultiPolygon: an array of polygons,
 * each an array of linear rings (outer + holes), each ring an array of
 * positions.
 */
export type BoundaryMultiPolygon = {
  type: 'MultiPolygon';
  coordinates: [number, number][][][];
};

export interface BoundaryShape {
  id: string;
  name: string;
  /** The linked proposal category term, or null if the boundary is unlinked. */
  taxonomyTermId: string | null;
  geometry: BoundaryMultiPolygon;
}

/**
 * Returns every boundary owned by the given decision profile as a GeoJSON
 * MultiPolygon, so the editable location picker can render the valid-area
 * outline for that decision. PostGIS emits GeoJSON directly via `ST_AsGeoJSON`
 * to avoid round-tripping the WKB through the Node layer.
 */
export async function listBoundaryShapes({
  profileId,
}: {
  profileId: string;
}): Promise<BoundaryShape[]> {
  const rows = await db
    .select({
      id: decisionBoundaries.id,
      name: decisionBoundaries.name,
      taxonomyTermId: decisionBoundaries.taxonomyTermId,
      // ST_AsGeoJSON returns the geometry as a JSON-encoded string; we parse it
      // once here so callers always receive a typed MultiPolygon object.
      geometry: sql<string>`ST_AsGeoJSON(${decisionBoundaries.boundary})`,
    })
    .from(decisionBoundaries)
    .where(eq(decisionBoundaries.profileId, profileId));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    taxonomyTermId: row.taxonomyTermId,
    geometry: JSON.parse(row.geometry) as BoundaryMultiPolygon,
  }));
}
