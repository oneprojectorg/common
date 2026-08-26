import { customType } from 'drizzle-orm/pg-core';

export const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

/**
 * PostGIS MultiPolygon geometry in WGS84 (SRID 4326).
 *
 * Drizzle's built-in `geometry()` only models `point`, so polygon boundaries
 * use this custom type. The column is opaque to the ORM — it is written and
 * read via raw `sql` PostGIS functions (`ST_GeomFromGeoJSON`, `ST_Contains`,
 * etc.), so we surface it as a string (the WKT/EWKB Postgres returns).
 */
export const multiPolygon = customType<{ data: string }>({
  dataType() {
    return 'geometry(MultiPolygon,4326)';
  },
});

// `text` column pinned to byte-order collation. The `fractional-indexing`
// package mixes upper/lowercase ASCII (e.g. "Zz" sorts before "a0" by byte but
// AFTER "a0" under `en_US.utf8`, Supabase's default). Without `COLLATE "C"`
// prepends silently invert in production. The column-level collation flows
// into any index or ORDER BY automatically.
export const asciiText = customType<{ data: string }>({
  dataType() {
    return 'text COLLATE "C"';
  },
});

/**
 * PostgreSQL tstzrange (timestamp with timezone range) type
 * Used for temporal validity ranges in history tables
 *
 * Format: [lower, upper) - includes lower bound, excludes upper bound
 * Unbounded upper (for current version): [lower,)
 */
export const tstzrange = customType<{
  data: { from: string; to: string | null };
}>({
  dataType() {
    return 'tstzrange';
  },
  toDriver(value: { from: string; to: string | null }) {
    if (value.to === null) {
      return `[${value.from},)`; // Unbounded upper range (current version)
    }
    return `[${value.from},${value.to})`;
  },
  fromDriver(value: unknown) {
    if (typeof value !== 'string') {
      throw new Error(`Expected string for tstzrange, got ${typeof value}`);
    }
    // Parse PostgreSQL range format: [2024-01-01,2024-01-02)
    const match = value.match(/\[([^,]+),([^)]*)\)/);
    if (!match || !match[1]) {
      throw new Error(`Invalid tstzrange format: ${value}`);
    }
    return {
      from: match[1],
      to: match[2] || null,
    };
  },
});
