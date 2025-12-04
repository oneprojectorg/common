import { JoinProfileRequestStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { TestJoinProfileRequestDataManager } from '../../test/helpers/TestJoinProfileRequestDataManager';
import { TestOrganizationDataManager } from '../../test/helpers/TestOrganizationDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';
import { listJoinProfileRequestsRouter } from './listJoinProfileRequests';

describe.concurrent('profile.listJoinProfileRequests', () => {
  const createCaller = createCallerFactory(listJoinProfileRequestsRouter);

  it('should return empty list when no join requests exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    const { organizationProfile: targetProfile, adminUser } =
      await testData.createOrganization();

    const { session } = await createIsolatedSession(adminUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.listJoinProfileRequests({
      targetProfileId: targetProfile.id,
    });

    expect(result).toEqual({
      items: [],
      hasMore: false,
      next: null,
    });
  });

  it('should return join requests for the target profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const joinRequestData = new TestJoinProfileRequestDataManager(
      task.id,
      onTestFinished,
    );

    // Create target org (admin will view requests)
    const { organizationProfile: targetProfile, adminUser: targetAdmin } =
      await testData.createOrganization();

    // Create two requester orgs (their users will create join requests)
    const { adminUser: requester1 } = await testData.createOrganization();
    const { adminUser: requester2 } = await testData.createOrganization();

    // Create join requests using the manager
    await joinRequestData.createJoinRequestsForTarget({
      targetProfileId: targetProfile.id,
      requesters: [
        { profileId: requester1.profileId },
        { profileId: requester2.profileId },
      ],
    });

    const { session } = await createIsolatedSession(targetAdmin.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.listJoinProfileRequests({
      targetProfileId: targetProfile.id,
    });

    expect(result).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({
          status: 'pending',
          requestProfile: expect.objectContaining({ id: requester1.profileId }),
          targetProfile: expect.objectContaining({ id: targetProfile.id }),
        }),
        expect.objectContaining({
          status: 'pending',
          requestProfile: expect.objectContaining({ id: requester2.profileId }),
          targetProfile: expect.objectContaining({ id: targetProfile.id }),
        }),
      ]),
      hasMore: false,
      next: null,
    });
    expect(result.items).toHaveLength(2);
  });

  it('should support pagination with limit and cursor', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const joinRequestData = new TestJoinProfileRequestDataManager(
      task.id,
      onTestFinished,
    );

    const { organizationProfile: targetProfile, adminUser: targetAdmin } =
      await testData.createOrganization();

    // Create 3 requesters
    const { adminUser: requester1 } = await testData.createOrganization();
    const { adminUser: requester2 } = await testData.createOrganization();
    const { adminUser: requester3 } = await testData.createOrganization();

    // Insert with small time delays to ensure deterministic ordering
    await joinRequestData.createJoinRequest({
      requestProfileId: requester1.profileId,
      targetProfileId: targetProfile.id,
    });

    await joinRequestData.createJoinRequest({
      requestProfileId: requester2.profileId,
      targetProfileId: targetProfile.id,
    });

    await joinRequestData.createJoinRequest({
      requestProfileId: requester3.profileId,
      targetProfileId: targetProfile.id,
    });

    const { session } = await createIsolatedSession(targetAdmin.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // First page with limit of 2
    const firstPage = await caller.listJoinProfileRequests({
      targetProfileId: targetProfile.id,
      limit: 2,
    });

    expect(firstPage).toMatchObject({
      items: expect.any(Array),
      hasMore: true,
      next: expect.any(String),
    });
    expect(firstPage.items).toHaveLength(2);

    // Second page using cursor
    const secondPage = await caller.listJoinProfileRequests({
      targetProfileId: targetProfile.id,
      limit: 2,
      cursor: firstPage.next,
    });

    expect(secondPage).toMatchObject({
      items: expect.any(Array),
      hasMore: false,
      next: null,
    });
    expect(secondPage.items).toHaveLength(1);

    // Verify no duplicates across pages
    const allIds = [
      ...firstPage.items.map((r) => r.requestProfile.id),
      ...secondPage.items.map((r) => r.requestProfile.id),
    ];
    expect(new Set(allIds).size).toBe(3);
  });

  it('should deny access to non-admin members', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    // Create target org with a member (non-admin)
    const { organizationProfile: targetProfile, memberUsers } =
      await testData.createOrganization({
        users: { admin: 1, member: 1 },
      });

    const memberUser = memberUsers[0]!;

    const { session } = await createIsolatedSession(memberUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.listJoinProfileRequests({
        targetProfileId: targetProfile.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
  });

  it('should deny access to users who are not members of the profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);

    // Create target org
    const { organizationProfile: targetProfile } =
      await testData.createOrganization();

    // Create separate org with user who is not a member of target profile
    const { adminUser: outsiderUser } = await testData.createOrganization();

    const { session } = await createIsolatedSession(outsiderUser.email);
    const caller = createCaller(await createTestContextWithSession(session));

    await expect(
      caller.listJoinProfileRequests({
        targetProfileId: targetProfile.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('should include requests with different statuses', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const joinRequestData = new TestJoinProfileRequestDataManager(
      task.id,
      onTestFinished,
    );

    const { organizationProfile: targetProfile, adminUser: targetAdmin } =
      await testData.createOrganization();

    const { adminUser: requester1 } = await testData.createOrganization();
    const { adminUser: requester2 } = await testData.createOrganization();
    const { adminUser: requester3 } = await testData.createOrganization();

    // Create requests with different statuses using the manager
    await joinRequestData.createJoinRequestsForTarget({
      targetProfileId: targetProfile.id,
      requesters: [
        { profileId: requester1.profileId, status: JoinProfileRequestStatus.PENDING },
        { profileId: requester2.profileId, status: JoinProfileRequestStatus.APPROVED },
        { profileId: requester3.profileId, status: JoinProfileRequestStatus.REJECTED },
      ],
    });

    const { session } = await createIsolatedSession(targetAdmin.email);
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.listJoinProfileRequests({
      targetProfileId: targetProfile.id,
    });

    expect(result).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({
          status: 'pending',
          requestProfile: expect.objectContaining({ id: requester1.profileId }),
          targetProfile: expect.objectContaining({ id: targetProfile.id }),
        }),
        expect.objectContaining({
          status: 'approved',
          requestProfile: expect.objectContaining({ id: requester2.profileId }),
          targetProfile: expect.objectContaining({ id: targetProfile.id }),
        }),
        expect.objectContaining({
          status: 'rejected',
          requestProfile: expect.objectContaining({ id: requester3.profileId }),
          targetProfile: expect.objectContaining({ id: targetProfile.id }),
        }),
      ]),
      hasMore: false,
      next: null,
    });
    expect(result.items).toHaveLength(3);
  });

  it('should filter requests by status when provided', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestOrganizationDataManager(task.id, onTestFinished);
    const joinRequestData = new TestJoinProfileRequestDataManager(
      task.id,
      onTestFinished,
    );

    const { organizationProfile: targetProfile, adminUser: targetAdmin } =
      await testData.createOrganization();

    const { adminUser: requester1 } = await testData.createOrganization();
    const { adminUser: requester2 } = await testData.createOrganization();
    const { adminUser: requester3 } = await testData.createOrganization();

    // Create requests with different statuses using the manager
    await joinRequestData.createJoinRequestsForTarget({
      targetProfileId: targetProfile.id,
      requesters: [
        { profileId: requester1.profileId, status: JoinProfileRequestStatus.PENDING },
        { profileId: requester2.profileId, status: JoinProfileRequestStatus.APPROVED },
        { profileId: requester3.profileId, status: JoinProfileRequestStatus.REJECTED },
      ],
    });

    const { session } = await createIsolatedSession(targetAdmin.email);
    const caller = createCaller(await createTestContextWithSession(session));

    // Filter by PENDING status
    const pendingResult = await caller.listJoinProfileRequests({
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.PENDING,
    });

    expect(pendingResult.items).toHaveLength(1);
    expect(pendingResult.items[0]).toMatchObject({
      status: 'pending',
      requestProfile: expect.objectContaining({ id: requester1.profileId }),
    });

    // Filter by APPROVED status
    const approvedResult = await caller.listJoinProfileRequests({
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.APPROVED,
    });

    expect(approvedResult.items).toHaveLength(1);
    expect(approvedResult.items[0]).toMatchObject({
      status: 'approved',
      requestProfile: expect.objectContaining({ id: requester2.profileId }),
    });

    // Filter by REJECTED status
    const rejectedResult = await caller.listJoinProfileRequests({
      targetProfileId: targetProfile.id,
      status: JoinProfileRequestStatus.REJECTED,
    });

    expect(rejectedResult.items).toHaveLength(1);
    expect(rejectedResult.items[0]).toMatchObject({
      status: 'rejected',
      requestProfile: expect.objectContaining({ id: requester3.profileId }),
    });
  });
});
