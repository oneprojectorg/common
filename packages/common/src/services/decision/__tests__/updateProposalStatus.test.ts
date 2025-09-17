import { db } from '@op/db/client';
import {
  organizations,
  processInstances,
  profiles,
  proposals,
  users,
  organizationUsers,
  organizationRoles,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError } from '../../../utils';
import { updateProposalStatus } from '../updateProposalStatus';

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

describe('updateProposalStatus', () => {
  let userId: string;
  let profileId: string;
  let orgProfileId: string;
  let organizationId: string;
  let processInstanceId: string;
  let proposalId: string;
  let adminRoleId: string;
  let memberRoleId: string;

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

    // Create roles
    const [adminRole] = await db
      .insert(organizationRoles)
      .values({
        organizationId,
        name: 'Admin',
        description: 'Admin role',
        permissions: {
          decisions: { read: true, create: true, update: true, delete: true },
        },
      })
      .returning();
    adminRoleId = adminRole.id;

    const [memberRole] = await db
      .insert(organizationRoles)
      .values({
        organizationId,
        name: 'Member',
        description: 'Member role',
        permissions: {
          decisions: { read: true },
        },
      })
      .returning();
    memberRoleId = memberRole.id;

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
    await db.delete(organizationUsers);
    await db.delete(organizationRoles);
    await db.delete(proposals);
    await db.delete(processInstances);
    await db.delete(organizations);
    await db.delete(profiles);
    await db.delete(users);
  });

  it('should update proposal status to approved for admin users', async () => {
    // Add user to organization with admin role
    await db.insert(organizationUsers).values({
      organizationId,
      authUserId: mockUser.id,
      roleIds: [adminRoleId],
    });

    const result = await updateProposalStatus({
      proposalId,
      status: 'approved',
      user: mockUser,
    });

    expect(result.status).toBe('approved');
  });

  it('should update proposal status to rejected for admin users', async () => {
    // Add user to organization with admin role
    await db.insert(organizationUsers).values({
      organizationId,
      authUserId: mockUser.id,
      roleIds: [adminRoleId],
    });

    const result = await updateProposalStatus({
      proposalId,
      status: 'rejected',
      user: mockUser,
    });

    expect(result.status).toBe('rejected');
  });

  it('should throw UnauthorizedError for non-admin users', async () => {
    // Add user to organization with member role (no admin permissions)
    await db.insert(organizationUsers).values({
      organizationId,
      authUserId: mockUser.id,
      roleIds: [memberRoleId],
    });

    await expect(
      updateProposalStatus({
        proposalId,
        status: 'approved',
        user: mockUser,
      })
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError for users not in organization', async () => {
    // Don't add user to organization

    await expect(
      updateProposalStatus({
        proposalId,
        status: 'approved',
        user: mockUser,
      })
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should throw NotFoundError for non-existent proposal', async () => {
    // Add user to organization with admin role
    await db.insert(organizationUsers).values({
      organizationId,
      authUserId: mockUser.id,
      roleIds: [adminRoleId],
    });

    await expect(
      updateProposalStatus({
        proposalId: 'non-existent-id',
        status: 'approved',
        user: mockUser,
      })
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw UnauthorizedError for unauthenticated user', async () => {
    await expect(
      updateProposalStatus({
        proposalId,
        status: 'approved',
        user: null as any,
      })
    ).rejects.toThrow(UnauthorizedError);
  });
});