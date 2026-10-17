import type { ThemeAnalysisResult } from '@op/api/encoders';

type Claim = ThemeAnalysisResult['claims'][number];
type CommonGround = ThemeAnalysisResult['commonGround'][number];
type Theme = ThemeAnalysisResult['themes'][number];
type Outlier = ThemeAnalysisResult['outliers'][number];

/** How many quotes a point of common ground shows before the proposal list. */
export const MAX_STATEMENT_QUOTES = 3;

/**
 * How much a claim has to share with a statement before its quote is shown
 * under it. Overlap coefficient over content words, so a short statement is
 * not penalised for being short. Below this, the quote is more likely about
 * something else the same proposal said.
 */
const MIN_STATEMENT_OVERLAP = 0.2;

/** A quote shown under a point of common ground, with the proposal it is from. */
export interface StatementQuote {
  quote: string;
  proposal: Claim['proposal'];
}

/** One theme as the page lists it: its size, and its share of the largest. */
export interface ThemeRow {
  theme: Theme;
  /** Distinct proposals behind the theme. */
  count: number;
  /** `count` over the largest theme's count, 0 to 100, for the bar. */
  share: number;
}

/**
 * Words too common to say what a sentence is about. English only: the prompts
 * answer in English, and a stop word that is not in the list costs at most one
 * shared token, not a wrong quote.
 */
const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'for',
  'with',
  'at',
  'by',
  'from',
  'is',
  'are',
  'be',
  'was',
  'were',
  'that',
  'this',
  'these',
  'those',
  'it',
  'its',
  'as',
  'we',
  'our',
  'they',
  'their',
  'there',
  'more',
  'most',
  'should',
  'would',
  'could',
  'can',
  'will',
  'have',
  'has',
  'had',
  'not',
  'but',
  'so',
  'into',
  'than',
  'all',
  'any',
  'some',
  'one',
  'also',
  'about',
  'which',
  'who',
  'what',
  'when',
  'where',
  'need',
  'needs',
  'want',
  'wants',
  'proposal',
  'proposals',
  'people',
]);

/**
 * A word with its common English endings removed, so "schools" and "school",
 * "safer", "safely" and "safe" count as the same word. The trailing "e" goes
 * last so "safe" and "safer" land on the same stem. Crude on purpose: a stem
 * that is wrong for one word costs one token of overlap, and a real stemmer is
 * a dependency for a heuristic.
 */
const stem = (word: string): string =>
  word
    .replace(/ies$/, 'y')
    .replace(/sses$/, 'ss')
    .replace(/([^s])s$/, '$1')
    .replace(/(ing|ed|ly|er|est)$/, '')
    .replace(/e$/, '');

/** The content words of a sentence: lower-cased, stemmed, stop words dropped. */
export const contentWords = (text: string): Set<string> =>
  new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
      .map(stem),
  );

/** |A ∩ B| / min(|A|, |B|): how much of the smaller set the two share. */
const overlapCoefficient = (left: Set<string>, right: Set<string>): number => {
  const smaller = Math.min(left.size, right.size);

  if (smaller === 0) {
    return 0;
  }

  let shared = 0;

  for (const word of left) {
    if (right.has(word)) {
      shared += 1;
    }
  }

  return shared / smaller;
};

/**
 * The quotes to show under a point of common ground.
 *
 * The analysis records which proposals share a statement, but not which of
 * each proposal's claims is the one that does — a proposal makes several
 * points, and only one of them is this. So a quote is shown only when the
 * claim it belongs to shares enough words with the statement to be about the
 * same thing, and at most one per proposal, best match first. A statement
 * none of the claims match shows its proposals and no quotes, which is the
 * honest outcome: the agreement was found, and the words for it were not.
 *
 * Deterministic for a given snapshot: ties keep the claims' stored order.
 */
export const resolveStatementQuotes = (
  statement: CommonGround,
  claims: readonly Claim[],
  limit: number = MAX_STATEMENT_QUOTES,
): StatementQuote[] => {
  const behind = new Set(statement.proposals.map((proposal) => proposal.id));
  const target = contentWords(statement.statement);

  if (target.size === 0 || behind.size === 0) {
    return [];
  }

  const scored = claims
    .filter((claim) => claim.quote !== '' && behind.has(claim.proposal.id))
    .map((claim, position) => ({
      claim,
      position,
      score: overlapCoefficient(
        target,
        contentWords(`${claim.claim} ${claim.quote}`),
      ),
    }))
    .filter(({ score }) => score >= MIN_STATEMENT_OVERLAP)
    // In memory and never paginated: the claims are the whole snapshot.
    .sort(
      (left, right) =>
        right.score - left.score || left.position - right.position,
    );

  const quoted = new Set<string>();
  const picked: StatementQuote[] = [];

  for (const { claim } of scored) {
    if (quoted.has(claim.proposal.id)) {
      continue;
    }

    quoted.add(claim.proposal.id);
    picked.push({ quote: claim.quote, proposal: claim.proposal });

    if (picked.length === limit) {
      break;
    }
  }

  return picked;
};

/**
 * The themes, largest first, each with its share of the largest for a bar.
 *
 * Proposals rather than claims: a resident reads "how many asked for this",
 * and a proposal that makes three points about parks is one proposal, not
 * three. Themes with no proposals (every reference failed grounding) sort last
 * and draw an empty bar rather than disappearing, so the count of themes on
 * the page matches the count in the tile.
 */
export const resolveThemeRows = (themes: readonly Theme[]): ThemeRow[] => {
  const counted = themes.map((theme) => ({
    theme,
    count: theme.proposals.length,
  }));
  const largest = Math.max(0, ...counted.map(({ count }) => count));

  return (
    counted
      // In memory: the snapshot holds every theme.
      .sort((left, right) => right.count - left.count)
      .map(({ theme, count }) => ({
        theme,
        count,
        share: largest === 0 ? 0 : Math.round((100 * count) / largest),
      }))
  );
};

/** The share of the analysed proposals a statement covers, 0 to 100. */
export const statementShare = (
  statement: CommonGround,
  analyzedCount: number,
): number =>
  analyzedCount === 0
    ? 0
    : Math.min(
        100,
        Math.round((100 * statement.proposals.length) / analyzedCount),
      );

/**
 * The outliers worth a resident's attention first.
 *
 * High-impact ones lead: an outlier that proposes something nothing else does
 * is the finding the section exists for, and a reader who stops after two
 * rows should have met it. Stored order otherwise.
 */
export const resolveOutlierRows = (outliers: readonly Outlier[]): Outlier[] =>
  outliers
    .map((outlier, position) => ({ outlier, position }))
    // In memory: the snapshot holds every outlier.
    .sort(
      (left, right) =>
        Number(right.outlier.impact === 'high-impact') -
          Number(left.outlier.impact === 'high-impact') ||
        left.position - right.position,
    )
    .map(({ outlier }) => outlier);
