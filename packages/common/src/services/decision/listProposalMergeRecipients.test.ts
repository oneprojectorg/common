import { beforeEach, describe, expect, it, vi } from 'vitest';

// Boundary mock: drive the edge read and the note read, assert the filtering
// rules. Addresses come from `listProfileRecipients`, whose join onto
// `auth.users` is proven against the database in services/api.
vi.mock('@op/db/client', () => ({
  db: {
    query: {
      proposalRelationships: { findFirst: vi.fn() },
      users: { findFirst: vi.fn() },
    },
  },
}));

vi.mock('../email/recipients', () => ({
  listProfileRecipients: vi.fn(),
}));

import { db } from '@op/db/client';

import {
  type EmailRecipient,
  listProfileRecipients,
} from '../email/recipients';
import { listProposalMergeRecipients } from './listProposalMergeRecipients';

const RELATIONSHIP_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_AUTH_USER_ID = '22222222-2222-4222-8222-222222222222';
const ADA_AUTH_USER_ID = '33333333-3333-4333-8333-333333333333';
const GRACE_AUTH_USER_ID = '66666666-6666-4666-8666-666666666666';
const SOURCE_PROFILE_ID = '44444444-4444-4444-8444-444444444444';
const TARGET_PROFILE_ID = '55555555-5555-4555-8555-555555555555';

const findFirst = vi.mocked(db.query.proposalRelationships.findFirst);
const findUser = vi.mocked(db.query.users.findFirst);
const recipientsOf = vi.mocked(listProfileRecipients);

const ADA: EmailRecipient = {
  email: 'ada@example.com',
  authUserId: ADA_AUTH_USER_ID,
};
const GRACE: EmailRecipient = {
  email: 'grace@example.com',
  authUserId: GRACE_AUTH_USER_ID,
};

/** Who each proposal profile resolves to. */
const members = ({
  source = [ADA],
  target = [GRACE],
}: {
  source?: Array<EmailRecipient>;
  target?: Array<EmailRecipient>;
} = {}) => {
  recipientsOf.mockImplementation(async ({ profileId }) => {
    if (profileId === SOURCE_PROFILE_ID) {
      return source;
    }
    if (profileId === TARGET_PROFILE_ID) {
      return target;
    }
    return [];
  });
};

/** A live merged edge whose ends are both healthy. */
const edge = ({
  note = null as string | null,
  sourceDeletedAt = null,
  sourceModerationDetachedAt = null,
  targetDeletedAt = null,
  targetModerationDetachedAt = null,
}: {
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
    profile: { name: 'Community Garden Revamp' },
    processInstance: {
      profile: { name: 'Participatory Budgeting 2026', slug: 'pb-2026' },
    },
  },
  targetProposal: {
    deletedAt: targetDeletedAt,
    moderationDetachedAt: targetModerationDetachedAt,
    profileId: TARGET_PROFILE_ID,
    profile: { name: 'Neighbourhood Green Spaces' },
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
    members();
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

  it("resolves each side through its proposal's profile", async () => {
    findFirst.mockResolvedValue(edge() as never);

    await run();

    expect(recipientsOf).toHaveBeenCalledWith({ profileId: SOURCE_PROFILE_ID });
    expect(recipientsOf).toHaveBeenCalledWith({ profileId: TARGET_PROFILE_ID });
  });

  // An admin can unmerge inside the debounce window.
  it('sends nothing when the edge is no longer live', async () => {
    findFirst.mockResolvedValue(undefined as never);

    await expect(run()).resolves.toEqual({ ok: false, reason: 'edgeNotLive' });
    expect(recipientsOf).not.toHaveBeenCalled();
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
    const actor: EmailRecipient = {
      email: 'admin@example.com',
      authUserId: ACTOR_AUTH_USER_ID,
    };
    findFirst.mockResolvedValue(edge() as never);
    members({ source: [actor, ADA], target: [actor, GRACE] });

    const result = await run();

    expect(result).toMatchObject({
      ok: true,
      notification: {
        sourceRecipients: [{ email: 'ada@example.com' }],
        targetRecipients: [{ email: 'grace@example.com' }],
      },
    });
  });

  it('tells someone on both proposals only that theirs was merged away', async () => {
    findFirst.mockResolvedValue(edge() as never);
    members({ source: [ADA], target: [ADA, GRACE] });

    const result = await run();

    expect(result).toMatchObject({
      ok: true,
      notification: {
        sourceRecipients: [{ email: 'ada@example.com' }],
        targetRecipients: [{ email: 'grace@example.com' }],
      },
    });
  });

  it('deduplicates across sides by address, not just by account', async () => {
    findFirst.mockResolvedValue(edge() as never);
    members({
      source: [ADA],
      target: [{ email: 'Ada@Example.com', authUserId: 'a-second-account' }],
    });

    const result = await run();

    expect(result).toMatchObject({
      ok: true,
      notification: {
        sourceRecipients: [{ email: 'ada@example.com' }],
        targetRecipients: [],
      },
    });
  });

  // Otherwise they'd be excluded from both sides and hear nothing.
  it('still writes to someone on both sides whose source row has no address', async () => {
    findFirst.mockResolvedValue(edge() as never);
    members({
      source: [{ email: null, authUserId: ADA_AUTH_USER_ID }],
      target: [ADA],
    });

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
    findFirst.mockResolvedValue(edge() as never);
    members({
      source: [
        ADA,
        { email: 'Ada@Example.com', authUserId: ADA_AUTH_USER_ID },
        { email: null, authUserId: ADA_AUTH_USER_ID },
      ],
      target: [],
    });

    const result = await run();

    expect(result).toMatchObject({
      ok: true,
      notification: { sourceRecipients: [{ email: 'ada@example.com' }] },
    });
  });

  it('skips a collaborator with no account address', async () => {
    findFirst.mockResolvedValue(edge() as never);
    members({
      source: [{ email: null, authUserId: 'anonymous-account' }, ADA],
      target: [GRACE],
    });

    const result = await run();

    expect(result).toMatchObject({
      ok: true,
      notification: {
        sourceRecipients: [{ email: 'ada@example.com' }],
        targetRecipients: [{ email: 'grace@example.com' }],
      },
    });
  });

  it('reports no recipients only when neither side is addressable', async () => {
    findFirst.mockResolvedValue(edge() as never);
    members({ source: [], target: [] });

    await expect(run()).resolves.toEqual({ ok: false, reason: 'noRecipients' });
  });

  it('still writes to the surviving side when the merged proposal has no addresses', async () => {
    findFirst.mockResolvedValue(edge() as never);
    members({ source: [], target: [GRACE] });

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
