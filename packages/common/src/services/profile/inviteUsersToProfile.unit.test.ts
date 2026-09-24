import { db } from '@op/db/client';
import { event } from '@op/events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { assertProfile, assertProfileAccess } from '../assert';
import { inviteUsersToProfile } from './inviteUsersToProfile';

// Pull in `server-only` is blocked under Vitest; stub the modules whose
// imports would resolve to it. Only the surface this test exercises is wired
// up — table handles fall through as object identities the query builders
// can stringify without complaint.
vi.mock('@op/db/client', () => ({
  db: {
    query: {
      accessRoles: { findMany: vi.fn() },
      allowList: { findMany: vi.fn() },
      profileInvites: { findMany: vi.fn() },
      proposals: { findFirst: vi.fn() },
      processInstances: { findFirst: vi.fn() },
    },
    _query: {
      users: { findMany: vi.fn() },
    },
    transaction: vi.fn(),
  },
}));

vi.mock('@op/db/schema', () => ({
  ProcessStatus: { DRAFT: 'draft', PUBLISHED: 'published' },
  allowList: { _: 'allowList' },
  profileInvites: { id: 'profileInvites.id' },
}));

vi.mock('@op/events', () => ({
  Events: { profileInviteSent: { name: 'profile/invite.sent' } },
  event: { send: vi.fn() },
}));

vi.mock('@op/analytics', () => ({
  trackAdminInvitedParticipants: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@op/core', () => ({
  OPURLConfig: () => ({ ENV_URL: 'https://example.test' }),
}));

vi.mock('@vercel/functions', () => ({
  // Don't actually defer the analytics work — invoke its argument so a
  // rejection would surface as an unhandled rejection if the helper above
  // ever started throwing.
  waitUntil: (p: unknown) => p,
}));

vi.mock('../assert', () => ({
  assertProfile: vi.fn(),
  assertProfileAccess: vi.fn(),
}));

vi.mock('../access', () => ({
  assignableRoleFilter: vi.fn(),
}));

vi.mock('../decision/permissions', () => ({
  decisionPermission: { INVITE_MEMBERS: 0 },
}));

const mockTransaction = vi.mocked(db.transaction);
const mockEventSend = vi.mocked(event.send);
const mockAssertProfile = vi.mocked(assertProfile);
const mockAssertProfileAccess = vi.mocked(assertProfileAccess);
const mockAccessRolesFindMany = vi.mocked(db.query.accessRoles.findMany);
const mockUsersFindMany = vi.mocked(db._query.users.findMany);
const mockAllowListFindMany = vi.mocked(db.query.allowList.findMany);
const mockProfileInvitesFindMany = vi.mocked(db.query.profileInvites.findMany);
const mockProposalsFindFirst = vi.mocked(db.query.proposals.findFirst);
const mockProcessInstancesFindFirst = vi.mocked(
  db.query.processInstances.findFirst,
);

const PROFILE_ID = 'profile-1';
const REQUESTER_PROFILE_ID = 'requester-1';
const ROLE_ID = 'role-1';
const USER = {
  id: 'auth-user-1',
  email: 'requester@example.test',
} as Parameters<typeof inviteUsersToProfile>[0]['user'];

const invitationInput = {
  invitations: [{ email: 'invitee@example.test', roleId: ROLE_ID }],
  profileId: PROFILE_ID,
  requesterProfileId: REQUESTER_PROFILE_ID,
  user: USER,
};

const setHappyPathPreconditions = () => {
  mockAssertProfile.mockImplementation(async (id: string) =>
    id === PROFILE_ID
      ? ({ id, type: 'org', name: 'Org' } as never)
      : ({ id, type: 'org', name: 'Requester' } as never),
  );
  mockAssertProfileAccess.mockResolvedValue(undefined as never);
  mockAccessRolesFindMany.mockResolvedValue([
    { id: ROLE_ID, zonePermissions: [] },
  ] as never);
  mockUsersFindMany.mockResolvedValue([] as never);
  mockAllowListFindMany.mockResolvedValue([] as never);
  mockProfileInvitesFindMany.mockResolvedValue([] as never);
  mockProposalsFindFirst.mockResolvedValue(undefined as never);
  mockProcessInstancesFindFirst.mockResolvedValue(undefined as never);
};

describe('inviteUsersToProfile — event.send runs outside the db.transaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setHappyPathPreconditions();
  });

  it('commits invite rows even when event.send rejects (no rollback)', async () => {
    let txCallbackResolved = false;
    let eventSendCalledWhileTxOpen = false;
    let txOpen = false;

    mockTransaction.mockImplementation((async (
      cb: (tx: unknown) => Promise<unknown>,
    ) => {
      txOpen = true;
      const tx = {
        insert: () => ({
          values: () => ({
            returning: async () => [{ id: 'invite-1' }],
          }),
        }),
      };
      const result = await cb(tx);
      txOpen = false;
      txCallbackResolved = true;
      return result;
    }) as never);

    mockEventSend.mockImplementation(async () => {
      if (txOpen) {
        eventSendCalledWhileTxOpen = true;
      }
      throw new Error('Inngest brownout');
    });

    await expect(inviteUsersToProfile(invitationInput)).rejects.toThrow(
      /Inngest brownout/,
    );

    expect(txCallbackResolved).toBe(true);
    expect(eventSendCalledWhileTxOpen).toBe(false);
    expect(mockEventSend).toHaveBeenCalledTimes(1);
  });

  it('sends the notification after the transaction has resolved on the happy path', async () => {
    const callOrder: string[] = [];

    mockTransaction.mockImplementation((async (
      cb: (tx: unknown) => Promise<unknown>,
    ) => {
      const tx = {
        insert: () => ({
          values: () => ({
            returning: async () => {
              callOrder.push('tx.insert.returning');
              return [{ id: 'invite-1' }];
            },
          }),
        }),
      };
      const result = await cb(tx);
      callOrder.push('tx.resolved');
      return result;
    }) as never);

    mockEventSend.mockImplementation(async () => {
      callOrder.push('event.send');
    });

    const result = await inviteUsersToProfile(invitationInput);

    expect(result.success).toBe(true);
    expect(callOrder).toEqual([
      'tx.insert.returning',
      'tx.resolved',
      'event.send',
    ]);
  });
});
