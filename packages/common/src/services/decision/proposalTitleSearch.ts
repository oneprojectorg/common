import { SQL, and, db, eq, exists, ilike, or, sql } from '@op/db/client';
import { profiles, proposals } from '@op/db/schema';

// Unescaped, `%` and `_` in the query act as wildcards.
const escapeLikePattern = (value: string): string =>
  value.replace(/[\\%_]/g, (char) => `\\${char}`);

// Extra words are dropped, not rejected. Dropping a conjunct only widens the
// match, so the result stays a superset of what was asked for.
const MAX_SEARCH_WORDS = 10;

const splitSearchWords = (search: string | undefined): string[] =>
  (search ?? '').split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_WORDS);

/**
 * Title-search predicate for a proposal list query; `undefined` for an empty or
 * whitespace-only query.
 *
 * Titles live in `profiles.name`, kept current by updateProposal's autosave.
 * `proposalData.title` is frozen at creation — collab-doc titles resolve from a
 * TipTap fragment — so matching the JSON would match dead titles.
 *
 * Per-word `ILIKE '%word%'`, ANDed: order-independent and mid-word, neither of
 * which `profiles.search` can do (full-text matches from word starts, and its
 * vector covers bio and mission too). `profiles_name_trgm_idx` is what makes
 * the leading wildcard affordable; a word under three characters yields no
 * trigram and falls back to a scan of the already phase-scoped set.
 *
 * `t` is a parameter so callers can pass the relational `RAW` alias as well as
 * the schema table.
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

/**
 * A word this short yields no trigram, so `profiles_name_trgm_idx` can't serve
 * it and it matches inside far too many titles to carry signal. The search box
 * keeps such words — the user typed them deliberately, and they are ANDed with
 * the rest — but a title fed in automatically has no such intent behind it.
 */
const MIN_SUGGESTION_WORD_LENGTH = 3;

/**
 * The words of a proposal's own title, ready to feed back into a title search.
 *
 * Same tokenisation the search box gets, so "suggest proposals like this one"
 * and "search for these words" can never drift apart.
 */
export const getProposalTitleSearchWords = (
  title: string | undefined,
): string[] =>
  splitSearchWords(title).filter(
    (word) => word.length >= MIN_SUGGESTION_WORD_LENGTH,
  );

/**
 * Matches a proposal whose title contains AT LEAST ONE of `words`; `undefined`
 * for an empty list.
 *
 * The OR is what separates a suggestion from a search. `buildProposalTitle-
 * SearchCondition` ANDs its words because the user chose every one of them, but
 * the words here come from a whole title — requiring all of them would only ever
 * match a near-verbatim duplicate, which is not the set worth suggesting.
 * `buildProposalTitleMatchCount` then does the discriminating.
 */
export const buildProposalTitleAnyWordCondition = (
  t: typeof proposals,
  words: string[],
): SQL | undefined => {
  if (words.length === 0) {
    return undefined;
  }

  return exists(
    db
      .select({ id: profiles.id })
      .from(profiles)
      .where(
        and(
          eq(profiles.id, t.profileId),
          or(
            ...words.map((word) =>
              ilike(profiles.name, `%${escapeLikePattern(word)}%`),
            ),
          ),
        ),
      ),
  );
};

/**
 * How many of `words` appear in a proposal's title, as a correlated subquery so
 * it can drive `ORDER BY` alongside the caller's own WHERE clause.
 *
 * This is the ranking half of the suggestion list: with the OR predicate above
 * admitting anything that shares a single word, the count is what puts the
 * proposal sharing three words above the one that merely also says "community".
 * It also makes a stop word harmless — matching only "the" scores 1, so those
 * rows sort to the bottom on their own without a hardcoded, English-only list.
 */
export const buildProposalTitleMatchCount = (
  t: typeof proposals,
  words: string[],
): SQL<number> =>
  sql<number>`(
    SELECT ${sql.join(
      words.map(
        (word) =>
          sql`(CASE WHEN ${profiles.name} ILIKE ${`%${escapeLikePattern(word)}%`} THEN 1 ELSE 0 END)`,
      ),
      sql` + `,
    )}
    FROM ${profiles}
    WHERE ${profiles.id} = ${t.profileId}
  )`;
