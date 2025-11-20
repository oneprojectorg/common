import {
  createProcess,
  createInstance,
  createOrganization,
} from '@op/common';
import { db } from '@op/db/client';
import { appRouter } from 'src/routers';
import { createCallerFactory } from 'src/trpcFactory';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  cleanupTestData,
  createTestUser,
  getCurrentTestSession,
  signInTestUser,
  signOutTestUser,
} from '../supabase-utils';

const createCaller = createCallerFactory(appRouter);

describe('List Decision Profiles Integration Tests', () => {
  let testUserEmail: string;
  let testUser: any;
  let testOrganization: any;
  let testProcess: any;

  beforeEach(async () => {
    // Clean up before each test
    await cleanupTestData([
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
    testUserEmail = `test-${Date.now()}@example.com`;
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
          instanceData: {
            budget: 50000,
            hideBudget: false,
            currentStateId: 'initial',
          },
        },
        user: testUser,
      });

      // Create another instance
      const instance2 = await createInstance({
        data: {
          processId: testProcess.id,
          name: 'Decision Process 2',
          description: 'Second test decision process',
          instanceData: {
            budget: 100000,
            hideBudget: false,
            currentStateId: 'initial',
          },
        },
        user: testUser,
      });

      // Call the API
      const caller = createCaller({
        user: testUser,
        db,
        ip: '127.0.0.1',
        req: {} as any,
        reqUrl: 'http://localhost:3000/api/trpc',
        requestId: 'test-request-id',
        getCookies: () => ({}),
        getCookie: () => undefined,
        setCookie: () => {},
        time: Date.now(),
      });

      const result = await caller.decision.listDecisionProfiles({
        limit: 10,
      });

      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(false);

      // Verify first profile
      const profile1 = result.items.find((p) => p.name === 'Decision Process 1');
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
      const profile2 = result.items.find((p) => p.name === 'Decision Process 2');
      expect(profile2).toBeDefined();
      expect(profile2?.processInstance).toBeDefined();
      expect(profile2?.processInstance.name).toBe('Decision Process 2');
    });

    it('should filter by status', async () => {
      // Create instances with different statuses
      const instance1 = await createInstance({
        data: {
          processId: testProcess.id,
          name: 'Draft Process',
          instanceData: {
            budget: 50000,
            hideBudget: false,
            currentStateId: 'initial',
          },
        },
        user: testUser,
      });

      // Update to published status
      await db
        .update(db._.processInstances)
        .set({ status: 'published' })
        .where(db._.eq(db._.processInstances.id, instance1.id));

      const instance2 = await createInstance({
        data: {
          processId: testProcess.id,
          name: 'Draft Process 2',
          instanceData: {
            budget: 100000,
            hideBudget: false,
            currentStateId: 'initial',
          },
        },
        user: testUser,
      });

      const caller = createCaller({
        user: testUser,
        db,
        ip: '127.0.0.1',
        req: {} as any,
        reqUrl: 'http://localhost:3000/api/trpc',
        requestId: 'test-request-id',
        getCookies: () => ({}),
        getCookie: () => undefined,
        setCookie: () => {},
        time: Date.now(),
      });

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
        await createInstance({
          data: {
            processId: testProcess.id,
            name: `Process ${i}`,
            instanceData: {
              budget: 50000 * i,
              hideBudget: false,
              currentStateId: 'initial',
            },
          },
          user: testUser,
        });
      }

      const caller = createCaller({
        user: testUser,
        db,
        ip: '127.0.0.1',
        req: {} as any,
        reqUrl: 'http://localhost:3000/api/trpc',
        requestId: 'test-request-id',
        getCookies: () => ({}),
        getCookie: () => undefined,
        setCookie: () => {},
        time: Date.now(),
      });

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
      await createInstance({
        data: {
          processId: testProcess.id,
          name: 'Test Instance',
          instanceData: {
            budget: 50000,
            hideBudget: false,
            currentStateId: 'initial',
          },
        },
        user: testUser,
      });

      const caller = createCaller({
        user: testUser,
        db,
        ip: '127.0.0.1',
        req: {} as any,
        reqUrl: 'http://localhost:3000/api/trpc',
        requestId: 'test-request-id',
        getCookies: () => ({}),
        getCookie: () => undefined,
        setCookie: () => {},
        time: Date.now(),
      });

      const result = await caller.decision.listDecisionProfiles({
        limit: 10,
      });

      const profile = result.items[0];
      expect(profile?.processInstance.process).toBeDefined();
      expect(profile?.processInstance.process?.name).toBe('Test Process');
      expect(profile?.processInstance.owner).toBeDefined();
      expect(profile?.processInstance.owner?.id).toBe(testOrganization.profileId);
    });

    it('should return empty list when no decision profiles exist', async () => {
      const caller = createCaller({
        user: testUser,
        db,
        ip: '127.0.0.1',
        req: {} as any,
        reqUrl: 'http://localhost:3000/api/trpc',
        requestId: 'test-request-id',
        getCookies: () => ({}),
        getCookie: () => undefined,
        setCookie: () => {},
        time: Date.now(),
      });

      const result = await caller.decision.listDecisionProfiles({
        limit: 10,
      });

      expect(result.items).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });
  });
});
