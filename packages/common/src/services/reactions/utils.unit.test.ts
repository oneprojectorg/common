import { describe, expect, it } from 'vitest';

import { getLikeSummary, type ReactionRow } from './utils';

const reaction = (
  overrides: Partial<ReactionRow> & Pick<ReactionRow, 'reactionType'>,
): ReactionRow => ({
  profileId: 'profile-anon',
  createdAt: '2026-01-01T00:00:00.000Z',
  profile: null,
  ...overrides,
});

describe('getLikeSummary', () => {
  it('reports an empty summary when the post has no reactions', () => {
    expect(getLikeSummary({ reactions: [], profileId: 'viewer' })).toEqual({
      likeCount: 0,
      userHasLiked: false,
      likeUsers: [],
    });
  });

  it('counts every positive legacy reaction type as one like', () => {
    const summary = getLikeSummary({
      reactions: [
        reaction({ reactionType: 'like', profileId: 'a' }),
        reaction({ reactionType: 'love', profileId: 'b' }),
        reaction({ reactionType: 'laugh', profileId: 'c' }),
        reaction({ reactionType: 'folded_hands', profileId: 'd' }),
        reaction({ reactionType: 'celebrate', profileId: 'e' }),
        reaction({ reactionType: 'fire', profileId: 'f' }),
      ],
    });

    expect(summary.likeCount).toBe(6);
  });

  it('leaves negative legacy reactions out of the like count', () => {
    const summary = getLikeSummary({
      reactions: [
        reaction({ reactionType: 'like', profileId: 'a' }),
        reaction({ reactionType: 'dislike', profileId: 'b' }),
        reaction({ reactionType: 'sad', profileId: 'c' }),
      ],
    });

    expect(summary.likeCount).toBe(1);
  });

  it('treats a positive legacy reaction from the viewer as their like', () => {
    const summary = getLikeSummary({
      reactions: [reaction({ reactionType: 'fire', profileId: 'viewer' })],
      profileId: 'viewer',
    });

    expect(summary.userHasLiked).toBe(true);
  });

  it('does not treat the viewer’s negative reaction as a like', () => {
    const summary = getLikeSummary({
      reactions: [reaction({ reactionType: 'dislike', profileId: 'viewer' })],
      profileId: 'viewer',
    });

    expect(summary).toMatchObject({ likeCount: 0, userHasLiked: false });
  });

  it('leaves userHasLiked false for an anonymous viewer', () => {
    const summary = getLikeSummary({
      reactions: [reaction({ reactionType: 'like', profileId: 'a' })],
    });

    expect(summary.userHasLiked).toBe(false);
  });

  it('counts one profile once even when it holds several reaction rows', () => {
    const summary = getLikeSummary({
      reactions: [
        reaction({ reactionType: 'like', profileId: 'a' }),
        reaction({ reactionType: 'love', profileId: 'a' }),
        reaction({ reactionType: 'fire', profileId: 'b' }),
      ],
    });

    expect(summary.likeCount).toBe(2);
  });

  it('names at most a handful of likers, newest first', () => {
    const summary = getLikeSummary({
      reactions: Array.from({ length: 10 }, (_, index) =>
        reaction({
          reactionType: 'like',
          profileId: `profile-${index}`,
          profile: { id: `profile-${index}`, name: `Liker ${index}` },
          createdAt: new Date(2026, 0, index + 1).toISOString(),
        }),
      ),
    });

    expect(summary.likeCount).toBe(10);
    expect(summary.likeUsers).toHaveLength(2);
    expect(summary.likeUsers.map((liker) => liker.name)).toEqual([
      'Liker 9',
      'Liker 8',
    ]);
  });

  it('names only the likers it has a profile for', () => {
    const summary = getLikeSummary({
      reactions: [
        reaction({
          reactionType: 'love',
          profileId: 'a',
          profile: { id: 'a', name: 'Ada' },
          createdAt: '2026-02-01T00:00:00.000Z',
        }),
        reaction({ reactionType: 'like', profileId: 'b' }),
        reaction({
          reactionType: 'dislike',
          profileId: 'c',
          profile: { id: 'c', name: 'Cleo' },
        }),
      ],
    });

    expect(summary.likeCount).toBe(2);
    expect(summary.likeUsers).toEqual([
      { id: 'a', name: 'Ada', timestamp: new Date('2026-02-01T00:00:00.000Z') },
    ]);
  });

  it('falls back to the current time when a reaction timestamp is unusable', () => {
    const summary = getLikeSummary({
      reactions: [
        reaction({
          reactionType: 'like',
          profileId: 'a',
          profile: { id: 'a', name: 'Ada' },
          createdAt: 'not-a-date',
        }),
      ],
    });

    expect(summary.likeUsers[0]?.timestamp.getTime()).not.toBeNaN();
  });
});
