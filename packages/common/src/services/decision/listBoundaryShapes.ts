import { db, sql } from '@op/db/client';
import { decisionBoundaries } from '@op/db/schema';

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
 * Returns every persisted boundary as a GeoJSON MultiPolygon, so the editable
 * location picker can render the valid-area outline on the map. Boundaries are
 * deployment-global, so no filtering by org/process is applied. PostGIS emits
 * GeoJSON directly via `ST_AsGeoJSON` to avoid round-tripping the WKB through
 * the Node layer.
 */
export async function listBoundaryShapes(): Promise<BoundaryShape[]> {
  const rows = await db
    .select({
      id: decisionBoundaries.id,
      name: decisionBoundaries.name,
      taxonomyTermId: decisionBoundaries.taxonomyTermId,
      // ST_AsGeoJSON returns the geometry as a JSON-encoded string; we parse it
      // once here so callers always receive a typed MultiPolygon object.
      geometry: sql<string>`ST_AsGeoJSON(${decisionBoundaries.boundary})`,
    })
    .from(decisionBoundaries);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    taxonomyTermId: row.taxonomyTermId,
    geometry: JSON.parse(row.geometry) as BoundaryMultiPolygon,
  }));
}
