import { describe, expect, it, vi } from 'vitest';

// The module reaches for `db` to build its `exists(...)` subqueries at call
// time; the word tokenizer under test never touches it.
vi.mock('@op/db/client', async () => {
  const actual =
    await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
  return { ...actual, db: {} };
});

import { getProposalTitleSearchWords } from './proposalTitleSearch';

describe('getProposalTitleSearchWords', () => {
  it('splits a title into its words', () => {
    expect(getProposalTitleSearchWords('Riverside Bike Lanes')).toEqual([
      'Riverside',
      'Bike',
      'Lanes',
    ]);
  });

  it('drops words too short to yield a trigram', () => {
    // "on"/"a" match inside far too many titles to suggest anything useful,
    // and the trigram index can't serve them either.
    expect(getProposalTitleSearchWords('A Park on Fifth')).toEqual([
      'Park',
      'Fifth',
    ]);
  });

  it('collapses runs of whitespace instead of emitting empty words', () => {
    expect(getProposalTitleSearchWords('  Bike \n  Lanes  ')).toEqual([
      'Bike',
      'Lanes',
    ]);
  });

  it('caps the word count so a long title stays one bounded query', () => {
    const title = Array.from({ length: 20 }, (_, i) => `word${i}`).join(' ');

    expect(getProposalTitleSearchWords(title)).toHaveLength(10);
  });

  it('returns nothing for a title with no searchable word in it', () => {
    for (const title of ['', '   ', 'a of to', undefined]) {
      expect(getProposalTitleSearchWords(title)).toEqual([]);
    }
  });
});
