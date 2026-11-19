/**
 * SQL builders for filtering and faceting template answers held in a jsonb
 * column.
 *
 * Every builder takes the answers map as a caller-supplied jsonb expression
 * (`review_data -> 'answers'` today, `proposal_data` next) rather than a
 * table, so the same predicates serve both stores without a fork.
 *
 * Two constraints shape the output:
 *
 * 1. Predicates are written as `@>` containment against the *same* expression
 *    the GIN index is declared on, so the planner can use
 *    `USING gin ((review_data -> 'answers') jsonb_path_ops)`. `->>` equality
 *    and `= ANY(...)` read the same but cannot be served by that index.
 * 2. Counting and ordering happen in SQL. A facet count taken over a page of
 *    rows would describe the page, not the result set.
 */
import { type Column, type SQL, and, or, sql } from '@op/db/client';

import type { ChoiceCriterion, ChoiceKind } from './criteria';

/**
 * One `(criterion, option)` bucket as the facet query returns it. Snake case
 * because these are raw result columns, and the index signature is what
 * `db.execute`'s row generic requires.
 */
export interface FacetCountRow {
  [column: string]: unknown;
  facet_key: string;
  /** `null` for the bucket of reviews that left the criterion unanswered. */
  option_id: string | null;
  option_count: number;
}

/**
 * `<column> -> '<key>'` with the key written as SQL text, not a parameter.
 *
 * This is the one place the distinction is load-bearing. A GIN index declared
 * on the expression `(review_data -> 'answers')` is matched by comparing
 * parsed expressions, and `review_data -> $1` is not the same expression as
 * `review_data -> 'answers'` — so binding the key silently costs every
 * containment predicate its index, with no error to notice.
 *
 * `key` is restricted to word characters because it is inlined: these keys
 * are code constants naming a jsonb member, never user input.
 */
export function jsonbMemberExpr(column: Column, key: string): SQL {
  if (!/^\w+$/.test(key)) {
    throw new Error(
      `jsonbMemberExpr key must be a word-character literal, got "${key}"`,
    );
  }
  return sql`(${column} -> ${sql.raw(`'${key}'`)})`;
}

/**
 * A single criterion's filter: ANY-OF the given option ids.
 *
 * `undefined` when no option was requested, so the caller can drop the key
 * instead of emitting a predicate that matches everything (or nothing).
 *
 * Both kinds use containment, only the probe differs: a single choice stores
 * the id as a string (`{"k":"id"}`), a multi choice as an array, and jsonb
 * containment treats `{"k":["id"]}` as "the array at k includes id".
 */
export function choiceFilter({
  expr,
  key,
  kind,
  optionIds,
}: {
  expr: SQL;
  key: string;
  kind: ChoiceKind;
  optionIds: readonly string[];
}): SQL | undefined {
  if (optionIds.length === 0) {
    return undefined;
  }

  const probes = optionIds.map((optionId) => {
    const probe = JSON.stringify(
      kind === 'multi' ? { [key]: [optionId] } : { [key]: optionId },
    );
    return sql`${expr} @> ${probe}::jsonb`;
  });

  // A single option still gets wrapped: `or` of one clause renders bare, and
  // the parentheses keep the AND across keys unambiguous.
  return or(...probes);
}

/**
 * The whole filter payload: ANY-OF within a key, AND across keys.
 *
 * Only keys present in `criteria` produce a predicate — the caller has
 * already reported the rest. `exceptKey` drops one key, which is what makes a
 * facet count describe "what would happen if I changed this one filter".
 */
export function choiceFilters({
  expr,
  criteria,
  filters,
  exceptKey,
}: {
  expr: SQL;
  criteria: readonly ChoiceCriterion[];
  filters: Readonly<Record<string, readonly string[]>>;
  exceptKey?: string;
}): SQL | undefined {
  const clauses: SQL[] = [];

  for (const criterion of criteria) {
    if (criterion.key === exceptKey) {
      continue;
    }
    const optionIds = filters[criterion.key];
    if (!optionIds) {
      continue;
    }
    const clause = choiceFilter({
      expr,
      key: criterion.key,
      kind: criterion.kind,
      optionIds,
    });
    if (clause) {
      clauses.push(clause);
    }
  }

  return clauses.length > 0 ? and(...clauses) : undefined;
}

/**
 * Builds the scoped row set a facet branch counts over.
 *
 * Must render a parenthesised `SELECT` exposing an `answers` column holding
 * the jsonb answer map, already narrowed by the caller's own scope (instance,
 * phase, state, visibility) plus `extraWhere`. It is called once per distinct
 * excluded-key set, so the containment predicates stay in a `WHERE` clause
 * where the GIN index can serve them.
 */
export type ScopeSubqueryBuilder = (extraWhere: SQL | undefined) => SQL;

/**
 * One statement returning a count for every option of every criterion.
 *
 * ## Why it is shaped like this
 *
 * The obvious shape — one `UNION ALL` branch per criterion — re-reads the
 * whole scope once per branch, and measurement showed exactly that: buffer
 * accesses grew linearly with the branch count (130k blocks for 8 criteria
 * against 16k for one), and the cost fitted
 * `branches x (30 ms + 0.0007 ms/row)`. With eight criteria that is ~240 ms of
 * fixed cost before a row is read, and eight parallel-hash branches also
 * exhausted a 64 MB `/dev/shm`.
 *
 * So the scope is scanned once and every option is counted in that one pass by
 * its own `count(*) FILTER (WHERE ...)`. The counts come back as one wide row
 * and are unpivoted by a `LATERAL VALUES` list, so the caller still reads
 * `(facet_key, option_id, option_count)` triples.
 *
 * Two other shapes were measured and rejected: the per-criterion branches
 * above (261 ms at 3.2k rows, 420 ms at 38k) and a `CROSS JOIN` against a
 * catalogue `VALUES` list, which reads the same single scope but multiplies
 * every row by the catalogue before aggregating (73 ms / 390 ms). The
 * `FILTER` form measured 61 ms / 175 ms.
 *
 * ## Why there can still be more than one branch
 *
 * Standard faceting counts each key over the set filtered by all *other*
 * keys, so a key that is itself filtered needs a different `WHERE` from the
 * rest. Branches are therefore grouped by their excluded-key set, which is
 * the smallest number of scans the semantics allow: one for every unfiltered
 * criterion (they share the full filter set) plus one per actively filtered
 * key. No filters means exactly one scan; two active filters means three.
 *
 * The single and multi kinds share one predicate. `@>` on the member value is
 * true for an identical scalar and for an array containing it, so
 * `(answers -> 'k') @> '"id"'` answers both "is the choice id" and "is among
 * the chosen ids" — which also retires the multi kind's `jsonb_array_elements`
 * lateral and its `count(DISTINCT)`.
 *
 * Every catalogue option gets a row, zeros included, but the caller still
 * zips against the template: only the template knows the option order, and a
 * filtered-out criterion contributes no row at all.
 *
 * `undefined` when the template has no filterable criterion, so the caller
 * skips the round trip entirely.
 */
export function facetCountsQuery({
  criteria,
  filters,
  expr,
  scopeSubquery,
}: {
  criteria: readonly ChoiceCriterion[];
  filters: Readonly<Record<string, readonly string[]>>;
  expr: SQL;
  scopeSubquery: ScopeSubqueryBuilder;
}): SQL | undefined {
  if (criteria.length === 0) {
    return undefined;
  }

  const isFiltered = (criterion: ChoiceCriterion): boolean =>
    (filters[criterion.key]?.length ?? 0) > 0;

  // One group per distinct excluded-key set: the unfiltered criteria share
  // the full filter set, and each filtered key excludes only itself.
  const groups: Array<{
    exceptKey: string | undefined;
    members: ChoiceCriterion[];
  }> = [];

  const unfiltered = criteria.filter((criterion) => !isFiltered(criterion));
  if (unfiltered.length > 0) {
    groups.push({ exceptKey: undefined, members: unfiltered });
  }
  for (const criterion of criteria) {
    if (isFiltered(criterion)) {
      groups.push({ exceptKey: criterion.key, members: [criterion] });
    }
  }

  const branches = groups.map(({ exceptKey, members }) =>
    facetBranch({
      scope: scopeSubquery(
        choiceFilters({ expr, criteria, filters, exceptKey }),
      ),
      members,
    }),
  );

  return sql.join(branches, sql` UNION ALL `);
}

/**
 * One scan of `scope`, counting every option of every criterion in `members`.
 *
 * The aggregate aliases (`c0`, `c1`, ...) are generated ordinals, which is why
 * they can be emitted with `sql.raw`: nothing caller-supplied reaches the
 * identifier position. Keys and option ids are bound parameters.
 */
function facetBranch({
  scope,
  members,
}: {
  scope: SQL;
  members: readonly ChoiceCriterion[];
}): SQL {
  const probes = members.flatMap((criterion) =>
    criterion.optionIds.map((optionId) => ({ key: criterion.key, optionId })),
  );

  const aggregates = probes.map(
    (probe, index) =>
      sql`count(*) FILTER (WHERE (s.answers -> ${probe.key}) @> ${JSON.stringify(probe.optionId)}::jsonb)::int AS ${sql.raw(`c${index}`)}`,
  );

  // The first row's casts give the VALUES list its column types; Postgres
  // infers the rest from it.
  const rows = probes.map(
    (probe, index) =>
      sql`(${probe.key}::text, ${probe.optionId}::text, agg.${sql.raw(`c${index}`)})`,
  );

  return sql`
    SELECT f.facet_key, f.option_id, f.option_count
    FROM (SELECT ${sql.join(aggregates, sql`, `)} FROM ${scope} AS s) AS agg
    CROSS JOIN LATERAL (VALUES ${sql.join(rows, sql`, `)})
      AS f(facet_key, option_id, option_count)`;
}

/**
 * A descending sort key that puts NULLs last.
 *
 * Postgres sorts NULLs first on DESC, which would let an unsubmitted row lead
 * a newest-first list. Written as a COALESCE rather than `DESC NULLS LAST` so
 * the cursor can compare against the very same expression — a keyset cursor
 * is only stable while the comparison and the ORDER BY are literally the same
 * expression.
 */
export function descendingTimestampKey(column: Column | SQL): SQL {
  return sql`COALESCE(${column}, '-infinity'::timestamptz)`;
}

/**
 * "Strictly after the cursor row" for a descending `(timestamp, id)` keyset.
 *
 * A row-value comparison, so the tie-break is exact: rows sharing a timestamp
 * are split by id and no row is served twice or skipped.
 */
export function descendingTimestampKeyset({
  keyExpr,
  idColumn,
  cursorTimestamp,
  cursorId,
}: {
  keyExpr: SQL;
  idColumn: Column | SQL;
  cursorTimestamp: string | null;
  cursorId: string;
}): SQL {
  const cursorKey =
    cursorTimestamp === null
      ? sql`'-infinity'::timestamptz`
      : sql`${cursorTimestamp}::timestamptz`;

  return sql`(${keyExpr}, ${idColumn}) < (${cursorKey}, ${cursorId}::uuid)`;
}
