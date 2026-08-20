import { SQL, and, db, eq, exists, ilike } from '@op/db/client';
import { profiles, proposals } from '@op/db/schema';

// Match the query literally — unescaped, `%` matches every title.
const escapeLikePattern = (value: string): string =>
  value.replace(/[\\%_]/g, (char) => `\\${char}`);

/**
 * Cap on the number of words a single query can turn into predicates.
 *
 * Past it the extra words are dropped rather than the query rejected, matching
 * how `PROPOSAL_SEARCH_MAX_LENGTH` truncates an over-long query. Both cuts only
 * ever widen an already-narrow match — dropping a word removes a conjunct, and
 * a character cut that lands mid-word leaves a shorter substring — so the
 * result stays a superset of what was asked for rather than silently losing
 * rows.
 */
const MAX_SEARCH_WORDS = 10;

const splitSearchWords = (search: string | undefined): string[] =>
  (search ?? '').split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_WORDS);

/**
 * Builds the title-search predicate for a proposal list query, or `undefined`
 * when the query is empty or whitespace-only.
 *
 * Shared by every proposal list endpoint so their search semantics — and the
 * counts they report alongside the page — can't diverge. Parameterized on the
 * table reference so callers can pass either the schema table or the
 * relationally-aliased table from a v2 `RAW` callback.
 *
 * Title lives in `profiles.name` (kept current by updateProposal's autosave).
 * `proposalData.title` is frozen at creation — collab-doc titles resolve from a
 * TipTap fragment — so matching the JSON would match dead titles.
 *
 * Matching is `ILIKE '%word%'` per word, ANDed. `profiles_name_trgm_idx`
 * (GIN `gin_trgm_ops` on `profiles.name`) is what makes that affordable, and is
 * the reason this beats the `profiles.search` tsvector here: full-text search
 * matches only from word starts, so it could never find `ike` in "Bike", and
 * its vector is weighted over bio and mission as well as the name. A word under
 * three characters has no full trigram and falls back to a scan — bounded by
 * the phase-scoped proposal set the predicate correlates against.
 *
 * Postgres normalizes the EXISTS into a semi-join and picks the driving side by
 * cost. The correlating equality is on `profiles`' primary key, so in practice
 * it drives from the already phase-scoped proposals, probes `profiles_pkey`,
 * and applies the ILIKE as a filter.
 */
export const buildProposalTitleSearchCondition = (
  t: typeof proposals,
  search: string | undefined,
): SQL | undefined => {
  const searchWords = splitSearchWords(search);
  if (searchWords.length === 0) {
    return undefined;
  }

  return exists(
    db
      .select({ id: profiles.id })
      .from(profiles)
      .where(
        and(
          eq(profiles.id, t.profileId),
          ...searchWords.map((word) =>
            ilike(profiles.name, `%${escapeLikePattern(word)}%`),
          ),
        ),
      ),
  );
};
