import { ProposalStatus } from '@op/db/schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Boundary mock: drive the one read, assert the skip rules.
vi.mock('@op/db/client', () => ({
  db: { query: { proposals: { findFirst: vi.fn() } } },
}));

import { db } from '@op/db/client';

import { listProposalRejectionRecipients } from './listProposalRejectionRecipients';

const PROPOSAL_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_AUTH_USER_ID = '22222222-2222-4222-8222-222222222222';
const ADA_AUTH_USER_ID = '33333333-3333-4333-8333-333333333333';
const PROPOSAL_PROFILE_ID = '44444444-4444-4444-8444-444444444444';

const findFirst = vi.mocked(db.query.proposals.findFirst);

type ProfileUser = { email: string | null; authUserId: string };

const ADA = { email: 'ada@example.com', authUserId: ADA_AUTH_USER_ID };

const PHASES = [
  { phaseId: 'submission', name: 'Proposal Submission' },
  { phaseId: 'review', name: 'Review & Shortlist' },
  { phaseId: 'voting', name: 'Voting' },
];

/** A rejected proposal whose process and profile are both healthy. */
const rejectedProposal = ({
  status = ProposalStatus.REJECTED,
  profileUsers = [ADA] as Array<ProfileUser>,
  deletedAt = null as string | null,
  moderationDetachedAt = null as string | null,
  currentStateId = 'review' as string | null,
  phases = PHASES,
} = {}) => ({
  status,
  deletedAt,
  moderationDetachedAt,
  profileId: PROPOSAL_PROFILE_ID,
  profile: { name: 'Community Garden Revamp', profileUsers },
  processInstance: {
    currentStateId,
    instanceData: { phases },
    profile: { name: 'Participatory Budgeting 2026', slug: 'pb-2026' },
  },
});

const run = () =>
  listProposalRejectionRecipients({
    proposalId: PROPOSAL_ID,
    actorAuthUserId: ACTOR_AUTH_USER_ID,
  });

describe('listProposalRejectionRecipients', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('addresses the authors of a proposal that is still rejected', async () => {
    findFirst.mockResolvedValue(rejectedProposal() as never);

    await expect(run()).resolves.toEqual({
      ok: true,
      notification: {
        proposalName: 'Community Garden Revamp',
        proposalProfileId: PROPOSAL_PROFILE_ID,
        phaseName: 'Voting',
        processProfileSlug: 'pb-2026',
        recipients: [{ email: 'ada@example.com' }],
      },
    });
  });

  // The email drops the clause rather than naming a phase that isn't there.
  it.each([
    ['the process is on its last phase', { currentStateId: 'voting' }],
    ['the process has no current phase', { currentStateId: null }],
    [
      'the next phase was never named',
      { phases: [{ phaseId: 'review' }, { phaseId: 'voting' }] },
    ],
  ])('names no phase when %s', async (_label, overrides) => {
    findFirst.mockResolvedValue(rejectedProposal(overrides) as never);

    const result = await run();

    expect(result.ok && result.notification.phaseName).toBeUndefined();
  });

  // The success toast puts Undo one tap away, inside the debounce window.
  it('sends nothing once the rejection has been undone', async () => {
    findFirst.mockResolvedValue(
      rejectedProposal({ status: ProposalStatus.SUBMITTED }) as never,
    );

    await expect(run()).resolves.toEqual({ ok: false, reason: 'notRejected' });
  });

  it.each([
    ['the proposal is gone', undefined],
    [
      'the proposal was deleted',
      rejectedProposal({ deletedAt: '2026-08-27T00:00:00.000Z' }),
    ],
    [
      'the proposal was moderation-detached',
      rejectedProposal({ moderationDetachedAt: '2026-08-27T00:00:00.000Z' }),
    ],
  ])('sends nothing when %s', async (_label, proposal) => {
    findFirst.mockResolvedValue(proposal as never);

    await expect(run()).resolves.toEqual({
      ok: false,
      reason: 'proposalUnavailable',
    });
  });

  // An admin rejecting their own proposal should not be emailed about it.
  it('drops the actor, and sends nothing when they were the only author', async () => {
    findFirst.mockResolvedValue(
      rejectedProposal({
        profileUsers: [
          { email: 'admin@example.com', authUserId: ACTOR_AUTH_USER_ID },
        ],
      }) as never,
    );

    await expect(run()).resolves.toEqual({ ok: false, reason: 'noRecipients' });
  });

  it('skips co-authors who have no address', async () => {
    findFirst.mockResolvedValue(
      rejectedProposal({
        profileUsers: [
          { email: null, authUserId: '55555555-5555-4555-8555-555555555555' },
          ADA,
        ],
      }) as never,
    );

    const result = await run();

    expect(result.ok && result.notification.recipients).toEqual([
      { email: 'ada@example.com' },
    ]);
  });
});
