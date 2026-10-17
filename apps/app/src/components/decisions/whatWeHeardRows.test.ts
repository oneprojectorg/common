import { describe, expect, it } from 'vitest';

import {
  MAX_STATEMENT_QUOTES,
  contentWords,
  resolveOutlierRows,
  resolveStatementQuotes,
  resolveThemeRows,
  statementShare,
} from './whatWeHeardRows';

const proposal = (id: string) => ({
  id,
  title: `Proposal ${id}`,
  profileId: null,
});

const claim = (id: string, text: string, quote = text) => ({
  claim: text,
  quote,
  proposal: proposal(id),
});

describe('contentWords', () => {
  it('keeps the words that carry the meaning, stemmed', () => {
    expect(
      contentWords('Make the streets safer to walk and cross near schools.'),
    ).toEqual(
      new Set(['mak', 'street', 'saf', 'walk', 'cross', 'near', 'school']),
    );
  });

  it('is case-insensitive and ignores punctuation', () => {
    expect(contentWords('Dog PARKS, please!')).toEqual(
      new Set(['dog', 'park', 'pleas']),
    );
  });

  it('reads "safe", "safer" and "safely" as one word', () => {
    expect(contentWords('safe safer safely')).toEqual(new Set(['saf']));
  });
});

describe('resolveStatementQuotes', () => {
  const statement = {
    statement:
      'Make the streets safer to walk and cross, especially near schools.',
    proposals: [proposal('a'), proposal('b'), proposal('c')],
  };

  // The point of the check. A proposal behind a statement can make several
  // points, and only one of them is the statement; the quote shown has to be
  // that one.
  it('shows the claim about the statement, not another claim from the same proposal', () => {
    const quotes = resolveStatementQuotes(statement, [
      claim('a', 'Plant more trees along the river.'),
      claim('a', 'Add a crosswalk so kids can cross safely to the school.'),
    ]);

    expect(quotes).toEqual([
      {
        quote: 'Add a crosswalk so kids can cross safely to the school.',
        proposal: proposal('a'),
      },
    ]);
  });

  it('ignores claims from proposals the statement does not name', () => {
    const quotes = resolveStatementQuotes(statement, [
      claim('z', 'The streets near the school are not safe to cross.'),
    ]);

    expect(quotes).toEqual([]);
  });

  it('skips a claim whose quote could not be found in its proposal', () => {
    const quotes = resolveStatementQuotes(statement, [
      claim('a', 'Streets near schools must be safer to cross.', ''),
    ]);

    expect(quotes).toEqual([]);
  });

  it('shows one quote per proposal, best match first, up to the limit', () => {
    const quotes = resolveStatementQuotes(statement, [
      claim('a', 'Safer streets near schools.'),
      claim(
        'a',
        'Safer streets to walk and cross near schools, with crossings.',
      ),
      claim('b', 'Slow the cars so it is safer to walk across the street.'),
      claim('c', 'Safer crossings near every school so children can walk.'),
    ]);

    expect(quotes.map(({ proposal: { id } }) => id)).toEqual(['a', 'c', 'b']);
    expect(quotes[0]?.quote).toBe('Safer streets near schools.');
  });

  it('caps the quotes', () => {
    const many = {
      statement: 'Fix the parks we already have.',
      proposals: ['a', 'b', 'c', 'd', 'e'].map(proposal),
    };
    const quotes = resolveStatementQuotes(
      many,
      ['a', 'b', 'c', 'd', 'e'].map((id) =>
        claim(id, 'Fix the parks we already have before building new ones.'),
      ),
    );

    expect(quotes).toHaveLength(MAX_STATEMENT_QUOTES);
  });

  // Agreement with no matching words is kept as agreement: the proposals are
  // listed under the statement either way, and a wrong quote would be worse
  // than none.
  it('shows nothing when no claim is about the statement', () => {
    const quotes = resolveStatementQuotes(statement, [
      claim('a', 'Keep the library open on Sundays.'),
      claim('b', 'More benches by the pond.'),
    ]);

    expect(quotes).toEqual([]);
  });
});

describe('resolveThemeRows', () => {
  const theme = (title: string, size: number) => ({
    title,
    summary: 'A summary.',
    claims: [],
    proposals: Array.from({ length: size }, (_unused, position) =>
      proposal(`${title}-${position}`),
    ),
  });

  it('orders the themes largest first with the bar relative to the largest', () => {
    const rows = resolveThemeRows([
      theme('Small', 2),
      theme('Large', 8),
      theme('Middle', 4),
    ]);

    expect(
      rows.map(({ theme: { title }, count, share }) => [title, count, share]),
    ).toEqual([
      ['Large', 8, 100],
      ['Middle', 4, 50],
      ['Small', 2, 25],
    ]);
  });

  it('keeps a theme that lost every proposal to grounding, at the end', () => {
    const rows = resolveThemeRows([theme('Empty', 0), theme('Full', 3)]);

    expect(rows.map(({ theme: { title }, share }) => [title, share])).toEqual([
      ['Full', 100],
      ['Empty', 0],
    ]);
  });

  it('draws no bar when nothing was grounded', () => {
    expect(resolveThemeRows([theme('Empty', 0)])).toEqual([
      { theme: theme('Empty', 0), count: 0, share: 0 },
    ]);
  });
});

describe('statementShare', () => {
  it('is the share of the analysed proposals, rounded', () => {
    const statement = {
      statement: 'S',
      proposals: [proposal('a'), proposal('b')],
    };

    expect(statementShare(statement, 7)).toBe(29);
  });

  it('is zero when nothing was analysed', () => {
    expect(statementShare({ statement: 'S', proposals: [] }, 0)).toBe(0);
  });
});

describe('resolveOutlierRows', () => {
  const outlier = (id: string, impact: 'high-impact' | 'low-impact') => ({
    proposal: proposal(id),
    impact,
    reason: 'Because.',
  });

  it('puts the high-impact outliers first and keeps the stored order otherwise', () => {
    const rows = resolveOutlierRows([
      outlier('a', 'low-impact'),
      outlier('b', 'high-impact'),
      outlier('c', 'low-impact'),
      outlier('d', 'high-impact'),
    ]);

    expect(rows.map(({ proposal: { id } }) => id)).toEqual([
      'b',
      'd',
      'a',
      'c',
    ]);
  });
});
