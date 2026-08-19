import { beforeEach, describe, expect, it, vi } from 'vitest';

// Boundary mock: this resolver is one read plus the filtering rules that decide
// who hears about a merge. We drive the read and assert the rules — the edge
// going stale, a proposal being pulled, and who gets dropped from the list.
vi.mock('@op/db/client', () => ({
  db: { query: { proposalRelationships: { findFirst: vi.fn() } } },
}));

import { db } from '@op/db/client';

import { listProposalMergeRecipients } from './listProposalMergeRecipients';

const RELATIONSHIP_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_AUTH_USER_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_AUTH_USER_ID = '33333333-3333-4333-8333-333333333333';
const SOURCE_PROFILE_ID = '44444444-4444-4444-8444-444444444444';
const TARGET_PROFILE_ID = '55555555-5555-4555-8555-555555555555';

const findFirst = vi.mocked(db.query.proposalRelationships.findFirst);

/** A live merged edge whose ends are both healthy. */
const edge = ({
  profileUsers = [
    { email: 'ada@example.com', authUserId: OTHER_AUTH_USER_ID },
  ] as Array<{ email: string | null; authUserId: string }>,
  sourceDeletedAt = null,
  sourceModerationDetachedAt = null,
  targetDeletedAt = null,
  targetModerationDetachedAt = null,
}: {
  profileUsers?: Array<{ email: string | null; authUserId: string }>;
  sourceDeletedAt?: string | null;
  sourceModerationDetachedAt?: string | null;
  targetDeletedAt?: string | null;
  targetModerationDetachedAt?: string | null;
} = {}) => ({
  id: RELATIONSHIP_ID,
  sourceProposal: {
    deletedAt: sourceDeletedAt,
    moderationDetachedAt: sourceModerationDetachedAt,
    profileId: SOURCE_PROFILE_ID,
    profile: { name: 'Community Garden Revamp', profileUsers },
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
  });

  it('returns both proposals and the decision for a live merge', async () => {
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
        recipients: [{ email: 'ada@example.com' }],
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

  it('drops the admin who performed the merge', async () => {
    findFirst.mockResolvedValue(
      edge({
        profileUsers: [
          { email: 'admin@example.com', authUserId: ACTOR_AUTH_USER_ID },
          { email: 'ada@example.com', authUserId: OTHER_AUTH_USER_ID },
        ],
      }) as never,
    );

    const result = await run();

    expect(result).toMatchObject({
      ok: true,
      notification: { recipients: [{ email: 'ada@example.com' }] },
    });
  });

  it('sends one email per address, not per collaborator row', async () => {
    findFirst.mockResolvedValue(
      edge({
        profileUsers: [
          { email: 'ada@example.com', authUserId: OTHER_AUTH_USER_ID },
          { email: 'Ada@Example.com', authUserId: OTHER_AUTH_USER_ID },
          { email: null, authUserId: OTHER_AUTH_USER_ID },
        ],
      }) as never,
    );

    const result = await run();

    expect(result).toMatchObject({
      ok: true,
      notification: { recipients: [{ email: 'ada@example.com' }] },
    });
  });

  it('reports no recipients when every collaborator lacks an address', async () => {
    findFirst.mockResolvedValue(
      edge({
        profileUsers: [{ email: null, authUserId: OTHER_AUTH_USER_ID }],
      }) as never,
    );

    await expect(run()).resolves.toEqual({ ok: false, reason: 'noRecipients' });
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
