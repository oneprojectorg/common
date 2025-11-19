import { customType } from 'drizzle-orm/pg-core';

export const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
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
