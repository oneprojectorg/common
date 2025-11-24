import { createInstance, createOrganization, createProcess } from '@op/common';
import { db, eq } from '@op/db/client';
import { processInstances, profileUsers } from '@op/db/schema';
import { appRouter } from 'src/routers';
import { createCallerFactory } from 'src/trpcFactory';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  cleanupTestData,
  createIsolatedSession,
  createTestContextWithSession,
  createTestUser,
  getCurrentTestSession,
  signInTestUser,
  signOutTestUser,
} from '../../../test/supabase-utils';

const createCaller = createCallerFactory(appRouter);

// Helper function to grant profile access to a user
async function grantProfileAccess(
  profileId: string,
  authUserId: string,
  email: string,
) {
  await db.insert(profileUsers).values({
    profileId,
    authUserId,
    email,
  });
}

// Helper function to create authenticated caller
async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

describe('List Decision Profiles Integration Tests', () => {
  let testUserEmail: string;
  let testUser: any;
  let testOrganization: any;
  let testProcess: any;

  // Helper to create valid instance data with phases
  const createValidInstanceData = (budget: number) => ({
    budget,
    hideBudget: false,
    currentStateId: 'initial',
    phases: [
      {
        stateId: 'initial',
        plannedStartDate: new Date().toISOString(),
        plannedEndDate: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      },
      {
        stateId: 'final',
        plannedStartDate: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        plannedEndDate: new Date(
          Date.now() + 14 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      },
    ],
  });

  beforeEach(async () => {
    // Clean up before each test
    await cleanupTestData([
      'profileUser_to_access_roles',
      'profile_users',
      'organization_user_to_access_roles',
      'organization_users',
      'proposals',
      'decision_process_instances',
      'decision_processes',
      'organizations',
      'profiles',
    ]);
    await signOutTestUser();

    // Create test user and organization
    testUserEmail = `test-${Date.now()}@oneproject.org`;
    await createTestUser(testUserEmail);
    await signInTestUser(testUserEmail);

    const session = await getCurrentTestSession();
    testUser = session?.user;

    // Create a test organization
    testOrganization = await createOrganization({
      data: {
        name: 'Test Organization',
        website: 'https://test.com',
        email: 'contact@test.com',
        orgType: 'nonprofit',
        bio: 'Organization for testing',
        mission: 'To test decision profiles',
        networkOrganization: false,
        isReceivingFunds: false,
        isOfferingFunds: false,
        acceptingApplications: false,
      },
      user: testUser,
    });

    // Create a decision process
    testProcess = await createProcess({
      data: {
        name: 'Test Process',
        description: 'A test decision process',
        processSchema: {
          name: 'Test Process',
          states: [
            {
              id: 'initial',
              name: 'Initial',
              type: 'initial',
            },
            {
              id: 'final',
              name: 'Final',
              type: 'final',
            },
          ],
          transitions: [
            {
              id: 'start',
              name: 'Start',
              from: 'initial',
              to: 'final',
            },
          ],
          initialState: 'initial',
          decisionDefinition: {},
          proposalTemplate: {},
        },
      },
      user: testUser,
      ownerProfileId: testOrganization.profileId,
    });
  });

  describe('listDecisionProfiles', () => {
    it('should list decision profiles with their process instances', async () => {
      // Create a decision process instance
      const instance1 = await createInstance({
        data: {
          processId: testProcess.id,
          name: 'Decision Process 1',
          description: 'First test decision process',
          instanceData: createValidInstanceData(50000),
        },
        user: testUser,
      });

      // Grant the user access to this profile
      await grantProfileAccess(instance1.profileId, testUser.id, testUserEmail);

      // Create another instance
      const instance2 = await createInstance({
        data: {
          processId: testProcess.id,
          name: 'Decision Process 2',
          description: 'Second test decision process',
          instanceData: createValidInstanceData(100000),
        },
        user: testUser,
      });

      // Grant the user access to this profile
      await grantProfileAccess(instance2.profileId, testUser.id, testUserEmail);

      // Call the API with fresh session
      const caller = await createAuthenticatedCaller(testUserEmail);

      const result = await caller.decision.listDecisionProfiles({
        limit: 10,
      });

      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(false);

      // Verify first profile
      const profile1 = result.items.find(
        (p) => p.name === 'Decision Process 1',
      );
      expect(profile1).toBeDefined();
      expect(profile1?.type).toBe('decision');
      expect(profile1?.processInstance).toBeDefined();
      expect(profile1?.processInstance.name).toBe('Decision Process 1');
      expect(profile1?.processInstance.status).toBe('draft');
      expect(profile1?.processInstance.proposalCount).toBe(0);
      expect(profile1?.processInstance.participantCount).toBe(0);
      expect(profile1?.processInstance.instanceData).toMatchObject({
        budget: 50000,
        hideBudget: false,
      });

      // Verify second profile
      const profile2 = result.items.find(
        (p) => p.name === 'Decision Process 2',
      );
      expect(profile2).toBeDefined();
      expect(profile2?.processInstance).toBeDefined();
      expect(profile2?.processInstance.name).toBe('Decision Process 2');
    });

    it.skip('should filter by status', async () => {
      // Create instances with different statuses
      const instance1 = await createInstance({
        data: {
          processId: testProcess.id,
          name: 'Draft Process',
          instanceData: createValidInstanceData(50000),
        },
        user: testUser,
      });

      // Grant access to first profile
      await grantProfileAccess(instance1.profileId, testUser.id, testUserEmail);

      // Update to published status
      await db
        .update(processInstances)
        .set({ status: 'published' })
        .where(eq(processInstances.id, instance1.id));

      const instance2 = await createInstance({
        data: {
          processId: testProcess.id,
          name: 'Draft Process 2',
          instanceData: createValidInstanceData(100000),
        },
        user: testUser,
      });

      // Grant access to second profile
      await grantProfileAccess(instance2.profileId, testUser.id, testUserEmail);

      const caller = await createAuthenticatedCaller(testUserEmail);

      const result = await caller.decision.listDecisionProfiles({
        limit: 10,
        status: 'published',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.name).toBe('Draft Process');
      expect(result.items[0]?.processInstance.status).toBe('published');
    });

    it('should respect limit parameter and pagination', async () => {
      // Create multiple instances
      for (let i = 1; i <= 3; i++) {
        const instance = await createInstance({
          data: {
            processId: testProcess.id,
            name: `Process ${i}`,
            instanceData: createValidInstanceData(50000 * i),
          },
          user: testUser,
        });

        // Grant access to each profile
        await grantProfileAccess(
          instance.profileId,
          testUser.id,
          testUserEmail,
        );
      }

      const caller = await createAuthenticatedCaller(testUserEmail);

      // Get first page
      const firstPage = await caller.decision.listDecisionProfiles({
        limit: 2,
      });

      expect(firstPage.items).toHaveLength(2);
      expect(firstPage.hasMore).toBe(true);
      expect(firstPage.next).toBeDefined();

      // Get second page
      const secondPage = await caller.decision.listDecisionProfiles({
        limit: 2,
        cursor: firstPage.next!,
      });

      expect(secondPage.items).toHaveLength(1);
      expect(secondPage.hasMore).toBe(false);
      expect(secondPage.items[0]?.id).not.toBe(firstPage.items[0]?.id);
      expect(secondPage.items[0]?.id).not.toBe(firstPage.items[1]?.id);
    });

    it('should include process and owner information', async () => {
      const instance = await createInstance({
        data: {
          processId: testProcess.id,
          name: 'Test Instance',
          instanceData: createValidInstanceData(50000),
        },
        user: testUser,
      });

      // Grant access to the profile
      await grantProfileAccess(instance.profileId, testUser.id, testUserEmail);

      const caller = await createAuthenticatedCaller(testUserEmail);

      const result = await caller.decision.listDecisionProfiles({
        limit: 10,
      });

      const profile = result.items[0];
      expect(profile?.processInstance.process).toBeDefined();
      expect(profile?.processInstance.process?.name).toBe('Test Process');
      expect(profile?.processInstance.owner).toBeDefined();
      expect(profile?.processInstance.owner?.id).toBe(
        testOrganization.profileId,
      );
    });

    it('should return empty list when no decision profiles exist', async () => {
      const caller = await createAuthenticatedCaller(testUserEmail);

      const result = await caller.decision.listDecisionProfiles({
        limit: 10,
      });

      expect(result.items).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it('should only show profiles the user has access to', async () => {
      // Create an instance and grant access
      const instance1 = await createInstance({
        data: {
          processId: testProcess.id,
          name: 'Accessible Process',
          instanceData: createValidInstanceData(50000),
        },
        user: testUser,
      });
      await grantProfileAccess(instance1.profileId, testUser.id, testUserEmail);

      // Create another instance WITHOUT granting access
      const instance2 = await createInstance({
        data: {
          processId: testProcess.id,
          name: 'Inaccessible Process',
          instanceData: createValidInstanceData(100000),
        },
        user: testUser,
      });

      const caller = await createAuthenticatedCaller(testUserEmail);

      const result = await caller.decision.listDecisionProfiles({
        limit: 10,
      });

      // Should only return the profile the user has access to
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.name).toBe('Accessible Process');
      expect(result.items[0]?.id).toBe(instance1.profileId);
    });
  });
});
