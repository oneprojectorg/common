import { beforeEach, describe, expect, it, vi } from 'vitest';

// Boundary mocks: this gate is pure orchestration over the DB + access
// helpers, so we drive those and assert the allow/deny decisions. @op/db/schema
// is left real (EntityType.DECISION / Visibility.HIDDEN are value comparisons).
const selectChain = { resolve: vi.fn() };

vi.mock('@op/db/client', () => ({
  db: {
    // db.select({...}).from(t).where(c).limit(n) → Promise<rows>
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => selectChain.resolve(),
        }),
      }),
    }),
    query: { proposals: { findFirst: vi.fn() } },
  },
  eq: vi.fn(),
}));

vi.mock('../access', () => ({
  assertProfileTypeAccess: vi.fn(),
  assertInstanceProfileAccess: vi.fn(),
  getProfileAccessUser: vi.fn(),
  getCurrentProfileId: vi.fn(),
}));

vi.mock('./moderationVisibility', () => ({
  hasActiveModerationFlag: vi.fn(),
}));

import { db } from '@op/db/client';

import {
  assertInstanceProfileAccess,
  assertProfileTypeAccess,
  getCurrentProfileId,
  getProfileAccessUser,
} from '../access';
import { assertModerationItemAccess } from './assertModerationItemAccess';
import { hasActiveModerationFlag } from './moderationVisibility';

const user = { id: 'auth-1' } as never;
const POST_ID = '11111111-1111-4111-8111-111111111111';
const PROPOSAL_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';

const proposalFindFirst = vi.mocked(db.query.proposals.findFirst);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(hasActiveModerationFlag).mockResolvedValue(false);
  vi.mocked(getProfileAccessUser).mockResolvedValue(undefined);
  vi.mocked(assertProfileTypeAccess).mockResolvedValue(undefined);
  vi.mocked(assertInstanceProfileAccess).mockResolvedValue(undefined as never);
});

describe('assertModerationItemAccess — post', () => {
  it('throws NotFound when the post does not exist', async () => {
    selectChain.resolve.mockResolvedValue([]);
    await expect(
      assertModerationItemAccess({ itemType: 'post', itemId: POST_ID, user }),
    ).rejects.toThrow();
  });

  it('passes a readable, unflagged post', async () => {
    selectChain.resolve.mockResolvedValue([
      { id: POST_ID, profileId: 'author', rootProfileId: 'root' },
    ]);
    await expect(
      assertModerationItemAccess({ itemType: 'post', itemId: POST_ID, user }),
    ).resolves.toBeUndefined();
  });

  it('propagates a read-access denial (assertProfileTypeAccess throws)', async () => {
    selectChain.resolve.mockResolvedValue([
      { id: POST_ID, profileId: 'author', rootProfileId: 'root' },
    ]);
    vi.mocked(assertProfileTypeAccess).mockRejectedValue(
      new Error('Unauthorized'),
    );
    await expect(
      assertModerationItemAccess({ itemType: 'post', itemId: POST_ID, user }),
    ).rejects.toThrow('Unauthorized');
  });

  it('lets the author flag their own already-flagged post', async () => {
    selectChain.resolve.mockResolvedValue([
      { id: POST_ID, profileId: 'author-profile', rootProfileId: 'root' },
    ]);
    vi.mocked(hasActiveModerationFlag).mockResolvedValue(true);
    vi.mocked(getCurrentProfileId).mockResolvedValue('author-profile');
    await expect(
      assertModerationItemAccess({ itemType: 'post', itemId: POST_ID, user }),
    ).resolves.toBeUndefined();
  });

  it('hides an already-flagged post from a non-author non-admin', async () => {
    selectChain.resolve.mockResolvedValue([
      { id: POST_ID, profileId: 'author-profile', rootProfileId: 'root' },
    ]);
    vi.mocked(hasActiveModerationFlag).mockResolvedValue(true);
    vi.mocked(getCurrentProfileId).mockResolvedValue('someone-else');
    // getProfileAccessUser → undefined (no admin roles) from beforeEach.
    await expect(
      assertModerationItemAccess({ itemType: 'post', itemId: POST_ID, user }),
    ).rejects.toThrow();
  });
});

describe('assertModerationItemAccess — proposal', () => {
  it('throws NotFound when the proposal does not exist', async () => {
    proposalFindFirst.mockResolvedValue(undefined as never);
    await expect(
      assertModerationItemAccess({
        itemType: 'proposal',
        itemId: PROPOSAL_ID,
        user,
      }),
    ).rejects.toThrow();
  });

  it('passes a readable VISIBLE proposal', async () => {
    proposalFindFirst.mockResolvedValue({
      id: PROPOSAL_ID,
      profileId: 'prop-profile',
      visibility: 'public',
      processInstance: { profileId: 'instance-profile' },
    } as never);
    await expect(
      assertModerationItemAccess({
        itemType: 'proposal',
        itemId: PROPOSAL_ID,
        user,
      }),
    ).resolves.toBeUndefined();
  });

  it('allows flagging a DRAFT proposal (drafts are reportable, not gated)', async () => {
    proposalFindFirst.mockResolvedValue({
      id: PROPOSAL_ID,
      profileId: 'prop-profile',
      status: 'draft',
      visibility: 'public',
      processInstance: { profileId: 'instance-profile' },
    } as never);
    await expect(
      assertModerationItemAccess({
        itemType: 'proposal',
        itemId: PROPOSAL_ID,
        user,
      }),
    ).resolves.toBeUndefined();
  });

  it('hides a HIDDEN proposal from a non-member non-admin', async () => {
    proposalFindFirst.mockResolvedValue({
      id: PROPOSAL_ID,
      profileId: 'prop-profile',
      visibility: 'hidden',
      processInstance: { profileId: 'instance-profile' },
    } as never);
    // No proposal-level access, no instance-admin roles (beforeEach default).
    await expect(
      assertModerationItemAccess({
        itemType: 'proposal',
        itemId: PROPOSAL_ID,
        user,
      }),
    ).rejects.toThrow();
  });

  it('lets a proposal-level member flag a HIDDEN proposal', async () => {
    proposalFindFirst.mockResolvedValue({
      id: PROPOSAL_ID,
      profileId: 'prop-profile',
      visibility: 'hidden',
      processInstance: { profileId: 'instance-profile' },
    } as never);
    // First getProfileAccessUser call (proposal profile) returns a member.
    vi.mocked(getProfileAccessUser).mockResolvedValueOnce({
      roles: [],
    } as never);
    await expect(
      assertModerationItemAccess({
        itemType: 'proposal',
        itemId: PROPOSAL_ID,
        user,
      }),
    ).resolves.toBeUndefined();
  });
});

describe('assertModerationItemAccess — user', () => {
  it('passes when the user exists', async () => {
    selectChain.resolve.mockResolvedValue([{ id: USER_ID }]);
    await expect(
      assertModerationItemAccess({ itemType: 'user', itemId: USER_ID, user }),
    ).resolves.toBeUndefined();
  });

  it('throws NotFound when the user does not exist', async () => {
    selectChain.resolve.mockResolvedValue([]);
    await expect(
      assertModerationItemAccess({ itemType: 'user', itemId: USER_ID, user }),
    ).rejects.toThrow();
  });
});
