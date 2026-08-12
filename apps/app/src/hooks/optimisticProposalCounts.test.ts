import { describe, expect, it } from 'vitest';

import { bumpProposalCount } from './optimisticProposalCounts';

const flat = (likes: number) => ({
  items: [
    { profileId: 'p1', likesCount: likes, followersCount: 3 },
    { profileId: 'p2', likesCount: 99, followersCount: 0 },
  ],
});

const infinite = (likes: number) => ({
  pageParams: [undefined],
  pages: [flat(likes)],
});

// listProposals — what the current-phase grid reads — names the array
// `proposals`, not `items`. Getting this wrong is invisible: the patch simply
// finds nothing and the count sits still.
const proposalsShape = (likes: number) => ({
  pageParams: [undefined],
  pages: [
    {
      total: 2,
      proposals: [
        { profileId: 'p1', likesCount: likes, followersCount: 3 },
        { profileId: 'p2', likesCount: 99, followersCount: 0 },
      ],
    },
  ],
});

describe('bumpProposalCount', () => {
  // Asserted against the whole returned shape rather than a drilled-in
  // property: the function's return is `unknown` by design, and matching
  // structurally keeps that honest instead of asserting a type back onto it.
  it('moves the matching row in a flat list and leaves the others alone', () => {
    expect(bumpProposalCount(flat(4), 'p1', 'likesCount', 1)).toMatchObject({
      items: [{ likesCount: 5, followersCount: 3 }, { likesCount: 99 }],
    });
  });

  it('walks the pages of an infinite list', () => {
    expect(
      bumpProposalCount(infinite(4), 'p1', 'likesCount', -1),
    ).toMatchObject({
      pages: [{ items: [{ likesCount: 3 }, { likesCount: 99 }] }],
    });
  });

  it('moves followersCount independently of likesCount', () => {
    expect(bumpProposalCount(flat(4), 'p1', 'followersCount', 1)).toMatchObject(
      {
        items: [{ likesCount: 4, followersCount: 4 }, { followersCount: 0 }],
      },
    );
  });

  it('never renders a negative count', () => {
    expect(bumpProposalCount(flat(0), 'p1', 'likesCount', -1)).toMatchObject({
      items: [{ likesCount: 0 }, { likesCount: 99 }],
    });
  });

  it('walks pages that name the array `proposals` (listProposals)', () => {
    expect(
      bumpProposalCount(proposalsShape(4), 'p1', 'likesCount', 1),
    ).toMatchObject({
      pages: [{ proposals: [{ likesCount: 5 }, { likesCount: 99 }] }],
    });
  });

  it('walks a flat `proposals` result (the ballot)', () => {
    const ballot = {
      proposals: [{ profileId: 'p1', likesCount: 4, followersCount: 3 }],
    };

    expect(bumpProposalCount(ballot, 'p1', 'followersCount', 1)).toMatchObject({
      proposals: [{ followersCount: 4 }],
    });
  });

  it('moves a bare proposal, the shape getProposal caches', () => {
    const single = { profileId: 'p1', likesCount: 4, followersCount: 3 };

    expect(bumpProposalCount(single, 'p1', 'likesCount', 1)).toMatchObject({
      likesCount: 5,
      followersCount: 3,
    });
    expect(single.likesCount).toBe(4);
  });

  it('leaves a bare proposal for someone else alone', () => {
    const single = { profileId: 'p2', likesCount: 4 };

    expect(bumpProposalCount(single, 'p1', 'likesCount', 1)).toBe(single);
  });

  it('leaves unrecognised cache shapes untouched', () => {
    const odd = { somethingElse: true };

    expect(bumpProposalCount(odd, 'p1', 'likesCount', 1)).toBe(odd);
    expect(bumpProposalCount(undefined, 'p1', 'likesCount', 1)).toBeUndefined();
  });

  it('does not mutate the cached object', () => {
    const before = flat(4);
    bumpProposalCount(before, 'p1', 'likesCount', 1);

    expect(before.items[0]!.likesCount).toBe(4);
  });
});
