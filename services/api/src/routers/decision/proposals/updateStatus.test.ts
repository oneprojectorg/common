import { db } from '@op/db/client';
import { organizations, processInstances, profiles, proposals, users } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { TRPCError } from '@trpc/server';

import { createContextInner } from '../../../context';
import { updateProposalStatusRouter } from './updateStatus';

const mockUser: User = {
  id: 'test-user-id',
  email: 'test@example.com',
  user_metadata: {},
  app_metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  aud: 'authenticated',
  role: 'authenticated',
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

describe('updateProposalStatus', () => {
  let userId: string;
  let profileId: string;
  let orgProfileId: string;
  let organizationId: string;
  let processInstanceId: string;
  let proposalId: string;

  beforeEach(async () => {
    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        authUserId: mockUser.id,
        email: mockUser.email,
        currentProfileId: null,
      })
      .returning();
    userId = user.id;

    // Create user profile
    const [userProfile] = await db
      .insert(profiles)
      .values({
        type: 'individual',
        name: 'Test User',
        slug: 'test-user',
      })
      .returning();
    profileId = userProfile.id;

    // Update user with profile
    await db
      .update(users)
      .set({ currentProfileId: profileId })
      .where({ id: userId });

    // Create organization profile
    const [orgProfile] = await db
      .insert(profiles)
      .values({
        type: 'org',
        name: 'Test Organization',
        slug: 'test-org',
      })
      .returning();
    orgProfileId = orgProfile.id;

    // Create organization
    const [org] = await db
      .insert(organizations)
      .values({
        profileId: orgProfileId,
        name: 'Test Organization',
      })
      .returning();
    organizationId = org.id;

    // Create process instance owned by organization
    const [processInstance] = await db
      .insert(processInstances)
      .values({
        processId: 'test-process-id',
        name: 'Test Process',
        ownerProfileId: orgProfileId,
        instanceData: {},
        status: 'active',
      })
      .returning();
    processInstanceId = processInstance.id;

    // Create proposal
    const [proposal] = await db
      .insert(proposals)
      .values({
        processInstanceId,
        submittedByProfileId: profileId,
        profileId,
        proposalData: { title: 'Test Proposal' },
        status: 'submitted',
      })
      .returning();
    proposalId = proposal.id;
  });

  afterEach(async () => {
    // Clean up test data
    await db.delete(proposals);
    await db.delete(processInstances);
    await db.delete(organizations);
    await db.delete(profiles);
    await db.delete(users);
  });

  it('should update proposal status to approved for admin users', async () => {
    const ctx = await createContextInner({
      req: {} as any,
      res: {} as any,
      user: mockUser,
      logger: mockLogger,
    });

    const caller = updateProposalStatusRouter.createCaller(ctx);

    const result = await caller.updateProposalStatus({
      proposalId,
      status: 'approved',
    });

    expect(result.status).toBe('approved');
  });

  it('should update proposal status to rejected for admin users', async () => {
    const ctx = await createContextInner({
      req: {} as any,
      res: {} as any,
      user: mockUser,
      logger: mockLogger,
    });

    const caller = updateProposalStatusRouter.createCaller(ctx);

    const result = await caller.updateProposalStatus({
      proposalId,
      status: 'rejected',
    });

    expect(result.status).toBe('rejected');
  });

  it('should throw unauthorized error for non-admin users', async () => {
    const ctx = await createContextInner({
      req: {} as any,
      res: {} as any,
      user: mockUser,
      logger: mockLogger,
    });

    const caller = updateProposalStatusRouter.createCaller(ctx);

    await expect(
      caller.updateProposalStatus({
        proposalId,
        status: 'approved',
      })
    ).rejects.toThrow(TRPCError);
  });

  it('should throw error for invalid status', async () => {
    const ctx = await createContextInner({
      req: {} as any,
      res: {} as any,
      user: mockUser,
      logger: mockLogger,
    });

    const caller = updateProposalStatusRouter.createCaller(ctx);

    await expect(
      caller.updateProposalStatus({
        proposalId,
        status: 'invalid-status' as any,
      })
    ).rejects.toThrow();
  });

  it('should throw not found error for non-existent proposal', async () => {
    const ctx = await createContextInner({
      req: {} as any,
      res: {} as any,
      user: mockUser,
      logger: mockLogger,
    });

    const caller = updateProposalStatusRouter.createCaller(ctx);

    await expect(
      caller.updateProposalStatus({
        proposalId: 'non-existent-id',
        status: 'approved',
      })
    ).rejects.toThrow(TRPCError);
  });
});