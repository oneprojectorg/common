import { beforeEach, describe, expect, it, vi } from 'vitest';

// Boundary mock: this resolver is two reads plus the filtering rules that decide
// who hears about a merge and which side of it they hear. We drive the reads and
// assert the rules — the edge going stale, a proposal being pulled, and who
// lands in which audience.
vi.mock('@op/db/client', () => ({
  db: {
    query: {
      proposalRelationships: { findFirst: vi.fn() },
      users: { findFirst: vi.fn() },
    },
  },
}));

import { db } from '@op/db/client';

import { listProposalMergeRecipients } from './listProposalMergeRecipients';

const RELATIONSHIP_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_AUTH_USER_ID = '22222222-2222-4222-8222-222222222222';
const ADA_AUTH_USER_ID = '33333333-3333-4333-8333-333333333333';
const GRACE_AUTH_USER_ID = '66666666-6666-4666-8666-666666666666';
const SOURCE_PROFILE_ID = '44444444-4444-4444-8444-444444444444';
const TARGET_PROFILE_ID = '55555555-5555-4555-8555-555555555555';

const findFirst = vi.mocked(db.query.proposalRelationships.findFirst);
const findUser = vi.mocked(db.query.users.findFirst);

type ProfileUser = { email: string | null; authUserId: string };

const ADA = { email: 'ada@example.com', authUserId: ADA_AUTH_USER_ID };
const GRACE = { email: 'grace@example.com', authUserId: GRACE_AUTH_USER_ID };

/** A live merged edge whose ends are both healthy. */
const edge = ({
  sourceProfileUsers = [ADA] as Array<ProfileUser>,
  targetProfileUsers = [GRACE] as Array<ProfileUser>,
  note = null as string | null,
  sourceDeletedAt = null,
  sourceModerationDetachedAt = null,
  targetDeletedAt = null,
  targetModerationDetachedAt = null,
}: {
  sourceProfileUsers?: Array<ProfileUser>;
  targetProfileUsers?: Array<ProfileUser>;
  note?: string | null;
  sourceDeletedAt?: string | null;
  sourceModerationDetachedAt?: string | null;
  targetDeletedAt?: string | null;
  targetModerationDetachedAt?: string | null;
} = {}) => ({
  id: RELATIONSHIP_ID,
  note,
  sourceProposal: {
    deletedAt: sourceDeletedAt,
    moderationDetachedAt: sourceModerationDetachedAt,
    profileId: SOURCE_PROFILE_ID,
    profile: {
      name: 'Community Garden Revamp',
      profileUsers: sourceProfileUsers,
    },
    processInstance: {
      profile: { name: 'Participatory Budgeting 2026', slug: 'pb-2026' },
    },
  },
  targetProposal: {
    deletedAt: targetDeletedAt,
    moderationDetachedAt: targetModerationDetachedAt,
    profileId: TARGET_PROFILE_ID,
    profile: {
      name: 'Neighbourhood Green Spaces',
      profileUsers: targetProfileUsers,
    },
  },
});

const run = () =>
  listProposalMergeRecipients({
    relationshipId: RELATIONSHIP_ID,
    actorAuthUserId: ACTOR_AUTH_USER_ID,
  });

describe('listProposalMergeRecipients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUser.mockResolvedValue(undefined as never);
  });

  it('addresses each side of a live merge', async () => {
    findFirst.mockResolvedValue(edge() as never);

    const result = await run();

    expect(result).toEqual({
      ok: true,
      notification: {
        sourceProposalName: 'Community Garden Revamp',
        sourceProposalProfileId: SOURCE_PROFILE_ID,
        targetProposalName: 'Neighbourhood Green Spaces',
        targetProposalProfileId: TARGET_PROFILE_ID,
        processTitle: 'Participatory Budgeting 2026',
        processProfileSlug: 'pb-2026',
        note: null,
        sourceRecipients: [{ email: 'ada@example.com' }],
        targetRecipients: [{ email: 'grace@example.com' }],
      },
    });
  });

  // The debounce window is long enough for an admin to undo a merge before the
  // notification fires, and the edge soft-deletes rather than disappearing.
  it('sends nothing when the edge is no longer live', async () => {
    findFirst.mockResolvedValue(undefined as never);

    await expect(run()).resolves.toEqual({ ok: false, reason: 'edgeNotLive' });
  });

  it.each([
    ['the source was deleted', { sourceDeletedAt: '2026-08-19T00:00:00.000Z' }],
    [
      'the source was moderation-detached',
      { sourceModerationDetachedAt: '2026-08-19T00:00:00.000Z' },
    ],
    ['the target was deleted', { targetDeletedAt: '2026-08-19T00:00:00.000Z' }],
    [
      'the target was moderation-detached',
      { targetModerationDetachedAt: '2026-08-19T00:00:00.000Z' },
    ],
  ])('sends nothing when %s', async (_label, overrides) => {
    findFirst.mockResolvedValue(edge(overrides) as never);

    await expect(run()).resolves.toEqual({
      ok: false,
      reason: 'proposalUnavailable',
    });
  });

  it('drops the admin who performed the merge from both sides', async () => {
    const actor = {
      email: 'admin@example.com',
      authUserId: ACTOR_AUTH_USER_ID,
    };
    findFirst.mockResolvedValue(
      edge({
        sourceProfileUsers: [actor, ADA],
        targetProfileUsers: [actor, GRACE],
      }) as never,
    );

    const result = await run();

    expect(result).toMatchObject({
      ok: true,
      notification: {
        sourceRecipients: [{ email: 'ada@example.com' }],
        targetRecipients: [{ email: 'grace@example.com' }],
      },
    });
  });

  // The whole point of splitting the audiences: nobody gets told both that their
  // proposal was merged away and that something was merged into it.
  it('tells someone on both proposals only that theirs was merged away', async () => {
    findFirst.mockResolvedValue(
      edge({
        sourceProfileUsers: [ADA],
        targetProfileUsers: [ADA, GRACE],
      }) as never,
    );

    const result = await run();

    expect(result).toMatchObject({
      ok: true,
      notification: {
        sourceRecipients: [{ email: 'ada@example.com' }],
        targetRecipients: [{ email: 'grace@example.com' }],
      },
    });
  });

  // Same person, two accounts on the two proposals — the id check misses this,
  // so the address check has to catch it.
  it('deduplicates across sides by address, not just by account', async () => {
    findFirst.mockResolvedValue(
      edge({
        sourceProfileUsers: [ADA],
        targetProfileUsers: [
          { email: 'Ada@Example.com', authUserId: 'a-second-account' },
        ],
      }) as never,
    );

    const result = await run();

    expect(result).toMatchObject({
      ok: true,
      notification: {
        sourceRecipients: [{ email: 'ada@example.com' }],
        targetRecipients: [],
      },
    });
  });

  // Their source row carries no address, so the source email never reached them.
  // Excluding them from the surviving side too would leave a reachable author
  // hearing nothing at all.
  it('still writes to someone on both sides whose source row has no address', async () => {
    findFirst.mockResolvedValue(
      edge({
        sourceProfileUsers: [{ email: null, authUserId: ADA_AUTH_USER_ID }],
        targetProfileUsers: [ADA],
      }) as never,
    );

    const result = await run();

    expect(result).toMatchObject({
      ok: true,
      notification: {
        sourceRecipients: [],
        targetRecipients: [{ email: 'ada@example.com' }],
      },
    });
  });

  it('sends one email per address, not per collaborator row', async () => {
    findFirst.mockResolvedValue(
      edge({
        sourceProfileUsers: [
          ADA,
          { email: 'Ada@Example.com', authUserId: ADA_AUTH_USER_ID },
          { email: null, authUserId: ADA_AUTH_USER_ID },
        ],
        targetProfileUsers: [],
      }) as never,
    );

    const result = await run();

    expect(result).toMatchObject({
      ok: true,
      notification: { sourceRecipients: [{ email: 'ada@example.com' }] },
    });
  });

  it('reports no recipients only when neither side is addressable', async () => {
    findFirst.mockResolvedValue(
      edge({ sourceProfileUsers: [], targetProfileUsers: [] }) as never,
    );

    await expect(run()).resolves.toEqual({ ok: false, reason: 'noRecipients' });
  });

  it('still writes to the surviving side when the merged proposal has no addresses', async () => {
    findFirst.mockResolvedValue(
      edge({ sourceProfileUsers: [], targetProfileUsers: [GRACE] }) as never,
    );

    await expect(run()).resolves.toMatchObject({
      ok: true,
      notification: {
        sourceRecipients: [],
        targetRecipients: [{ email: 'grace@example.com' }],
      },
    });
  });

  describe('the merge note', () => {
    it('quotes the note and attributes it to the admin who merged', async () => {
      findFirst.mockResolvedValue(
        edge({ note: 'Same site, one proposal.' }) as never,
      );
      findUser.mockResolvedValue({
        profile: { name: 'Aaron Tanaka' },
      } as never);

      const result = await run();

      expect(result).toMatchObject({
        ok: true,
        notification: {
          note: {
            body: 'Same site, one proposal.',
            authorName: 'Aaron Tanaka',
          },
        },
      });
      expect(findUser.mock.calls[0]?.[0]).toMatchObject({
        where: { authUserId: ACTOR_AUTH_USER_ID },
      });
    });

    // An unresolvable profile costs the attribution line, not the note.
    it('keeps the note when the admin has no resolvable profile', async () => {
      findFirst.mockResolvedValue(edge({ note: 'Consolidated.' }) as never);
      findUser.mockResolvedValue(undefined as never);

      await expect(run()).resolves.toMatchObject({
        ok: true,
        notification: { note: { body: 'Consolidated.', authorName: null } },
      });
    });

    it.each([
      ['absent', null],
      ['empty', ''],
    ])('reads as no note when the note is %s', async (_label, note) => {
      findFirst.mockResolvedValue(edge({ note }) as never);

      const result = await run();

      expect(result).toMatchObject({ ok: true, notification: { note: null } });
      expect(findUser).not.toHaveBeenCalled();
    });
  });

  // A `linked` edge would carry different copy, so this must not match one.
  it('only announces merges', async () => {
    findFirst.mockResolvedValue(edge() as never);

    await run();

    expect(findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: { relationshipType: 'merged', deletedAt: { isNull: true } },
    });
  });
});
