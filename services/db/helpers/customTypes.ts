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

const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'number');

/**
 * pgvector's wire format for a vector value. Exported because a query that
 * compares against a literal vector (`embedding <=> $1::vector`) binds the
 * parameter itself rather than going through the column's `toDriver`.
 */
export const toVectorLiteral = (value: number[]): string =>
  `[${value.join(',')}]`;

/**
 * pgvector `vector(n)` column. The extension is already installed (see the
 * `CREATE EXTENSION ... vector` in the initial migration).
 *
 * Drizzle ships its own `vector()`, but only in the postgres-js/pg-core builds
 * we don't use for custom dimensions here; this mirrors `multiPolygon` above by
 * modelling the type explicitly. The wire format is a bracketed list, so the
 * driver hooks convert to and from `number[]`.
 */
export const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    const dimensions = config?.dimensions;
    if (dimensions === undefined) {
      throw new Error('vector() requires a `dimensions` config');
    }
    return `vector(${dimensions})`;
  },
  toDriver: toVectorLiteral,
  fromDriver(value: unknown): number[] {
    if (typeof value !== 'string') {
      throw new Error(`Expected string for vector, got ${typeof value}`);
    }
    const parsed: unknown = JSON.parse(value);
    if (!isNumberArray(parsed)) {
      throw new Error(`Invalid vector format: ${value}`);
    }
    return parsed;
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
