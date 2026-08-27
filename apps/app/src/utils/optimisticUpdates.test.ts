import { describe, expect, it } from 'vitest';

import {
  applyLikeToggle,
  togglePostLike,
  type PostLikeState,
} from './optimisticUpdates';

const viewer = { id: 'viewer', name: 'Ada' };

const state = (overrides: Partial<PostLikeState> = {}): PostLikeState => ({
  likeCount: 0,
  userHasLiked: false,
  likeUsers: [],
  ...overrides,
});

describe('applyLikeToggle', () => {
  it('adds the viewer to an unliked post', () => {
    const next = applyLikeToggle(state({ likeCount: 2 }), viewer);

    expect(next).toMatchObject({ userHasLiked: true, likeCount: 3 });
    expect(next.likeUsers.map((liker) => liker.id)).toEqual(['viewer']);
  });

  it('removes the viewer from a post they had liked', () => {
    const next = applyLikeToggle(
      state({
        likeCount: 3,
        userHasLiked: true,
        likeUsers: [
          { id: 'viewer', name: 'Ada', timestamp: new Date('2026-02-02') },
          { id: 'other', name: 'Grace', timestamp: new Date('2026-02-01') },
        ],
      }),
      viewer,
    );

    expect(next).toMatchObject({ userHasLiked: false, likeCount: 2 });
    expect(next.likeUsers.map((liker) => liker.id)).toEqual(['other']);
  });

  it('lists the viewer first so the tooltip reads newest-first', () => {
    const next = applyLikeToggle(
      state({
        likeCount: 1,
        likeUsers: [
          { id: 'other', name: 'Grace', timestamp: new Date('2026-02-01') },
        ],
      }),
      viewer,
    );

    expect(next.likeUsers.map((liker) => liker.name)).toEqual(['Ada', 'Grace']);
  });

  it('never lists the viewer twice', () => {
    const next = applyLikeToggle(
      state({
        likeCount: 1,
        likeUsers: [
          { id: 'viewer', name: 'Ada', timestamp: new Date('2026-01-01') },
        ],
      }),
      viewer,
    );

    expect(
      next.likeUsers.filter((liker) => liker.id === 'viewer'),
    ).toHaveLength(1);
  });

  it('keeps the count at zero rather than going negative', () => {
    const next = applyLikeToggle(state({ userHasLiked: true }), viewer);

    expect(next.likeCount).toBe(0);
  });

  it('moves only the count when there is no current profile', () => {
    const existing = [
      { id: 'other', name: 'Grace', timestamp: new Date('2026-02-01') },
    ];
    const next = applyLikeToggle(
      state({ likeCount: 1, likeUsers: existing }),
      null,
    );

    expect(next).toMatchObject({ userHasLiked: true, likeCount: 2 });
    expect(next.likeUsers).toEqual(existing);
  });
});

describe('togglePostLike', () => {
  const item = (id: string) => ({
    post: { id, likeCount: 1, userHasLiked: false, likeUsers: [] },
  });

  it('leaves items for other posts untouched', () => {
    const other = item('other-post');

    expect(
      togglePostLike(other, 'target-post', { currentProfile: viewer }),
    ).toBe(other);
  });

  it('flips the like on the matching post', () => {
    const result = togglePostLike(item('target-post'), 'target-post', {
      currentProfile: viewer,
    });

    expect(result.post).toMatchObject({ userHasLiked: true, likeCount: 2 });
  });

  it('keeps the rest of the cached item intact', () => {
    const result = togglePostLike(
      { ...item('target-post'), organization: { id: 'org-1' } },
      'target-post',
      { currentProfile: viewer },
    );

    expect(result).toMatchObject({ organization: { id: 'org-1' } });
  });
});
