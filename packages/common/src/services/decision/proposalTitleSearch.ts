import { SQL, and, db, eq, exists, ilike } from '@op/db/client';
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
