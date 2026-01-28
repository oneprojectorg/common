import { ProcessStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

// Helper function to create authenticated caller
async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

describe.concurrent('listDecisionProfiles', () => {
  it('should list decision profiles with their process instances', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Create setup with 2 instances
    const setup = await testData.createDecisionSetup({
      instanceCount: 2,
      grantAccess: true,
    });

    // Call the API with fresh session
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.listDecisionProfiles({
      limit: 10,
    });

    expect(result.items).toHaveLength(2);
    expect(result.next).toBeNull();

    // Verify profiles have process instance data
    result.items.forEach((profile) => {
      expect(profile.type).toBe('decision');
      expect(profile.processInstance).toBeDefined();
      expect(profile.processInstance.status).toBe('draft');
      expect(profile.processInstance.proposalCount).toBe(0);
      expect(profile.processInstance.participantCount).toBe(0);
      expect(profile.processInstance.instanceData).toMatchObject({
        hideBudget: false,
      });
    });
  });

  it('should filter by status', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    // Create another published instance
    const publishedInstance = await testData.createInstanceForProcess({
      process: setup.process,
      user: setup.user,
      name: 'Published Process',
      budget: 100000,
      status: ProcessStatus.PUBLISHED,
    });

    await testData.grantProfileAccess(
      publishedInstance.profileId,
      setup.user.id,
      setup.userEmail,
    );

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.listDecisionProfiles({
      limit: 10,
      status: ProcessStatus.PUBLISHED,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.processInstance.status).toBe('published');
  });

  it('should filter by owner', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Create Org A
    const setup = await testData.createDecisionSetup({
      instanceCount: 2,
      grantAccess: true,
    });

    // Create Org B
    const otherSetup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    // Create 3 instances owned by Org B
    for (let i = 0; i < 3; i++) {
      const instance = await testData.createInstanceForProcess({
        process: otherSetup.process,
        user: otherSetup.user,
        name: `Other Org Instance ${i + 1}`,
        budget: 50000,
      });
      // Grant access to User A (from first setup)
      await testData.grantProfileAccess(
        instance.profileId,
        setup.user.id,
        setup.userEmail,
      );
    }

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.listDecisionProfiles({
      limit: 10,
      ownerProfileId: setup.organization.profileId,
    });

    expect(result.items).toHaveLength(2);
    result.items.forEach((item) => {
      expect(item.processInstance.owner?.id).toBe(setup.organization.profileId);
    });

    // Also verify filtering by Org B works
    const otherResult = await caller.decision.listDecisionProfiles({
      limit: 10,
      ownerProfileId: otherSetup.organization.profileId,
    });

    expect(otherResult.items).toHaveLength(3);
    otherResult.items.forEach((item) => {
      expect(item.processInstance.owner?.id).toBe(
        otherSetup.organization.profileId,
      );
    });
  });

  it('should filter by both owner and status', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Set up Org A
    const setup = await testData.createDecisionSetup({
      instanceCount: 2,
      grantAccess: true,
    });

    // Publish one of the decisions in Org A
    const publishedInstance = await testData.createInstanceForProcess({
      process: setup.process,
      user: setup.user,
      name: 'Published Process A',
      budget: 100000,
      status: ProcessStatus.PUBLISHED,
    });

    await testData.grantProfileAccess(
      publishedInstance.profileId,
      setup.user.id,
      setup.userEmail,
    );

    // Set up Org B
    const otherSetup = await testData.createDecisionSetup({
      instanceCount: 2,
      grantAccess: true,
    });

    // Publish one of the decisions in Org B
    const otherPublishedInstance = await testData.createInstanceForProcess({
      process: otherSetup.process,
      user: otherSetup.user,
      name: 'Published Process B',
      budget: 100000,
      status: ProcessStatus.PUBLISHED,
    });

    // Grant access to User A (from first setup)
    await testData.grantProfileAccess(
      otherPublishedInstance.profileId,
      setup.user.id,
      setup.userEmail,
    );

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.listDecisionProfiles({
      limit: 10,
      ownerProfileId: setup.organization.profileId,
      status: ProcessStatus.PUBLISHED,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.processInstance.status).toBe('published');
    expect(result.items[0]?.processInstance.owner?.id).toBe(
      setup.organization.profileId,
    );
  });

  it('should respect limit parameter and pagination', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 3,
      grantAccess: true,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Get first page
    const firstPage = await caller.decision.listDecisionProfiles({
      limit: 2,
    });

    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.next).toBeDefined();

    // Get second page
    const secondPage = await caller.decision.listDecisionProfiles({
      limit: 2,
      cursor: firstPage.next!,
    });

    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.next).toBeNull();
    expect(secondPage.items[0]?.id).not.toBe(firstPage.items[0]?.id);
    expect(secondPage.items[0]?.id).not.toBe(firstPage.items[1]?.id);
  });

  it('should include process and owner information', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.listDecisionProfiles({
      limit: 10,
    });

    const profile = result.items[0];
    expect(profile?.processInstance.process).toBeDefined();
    expect(profile?.processInstance.owner).toBeDefined();
    expect(profile?.processInstance.owner?.id).toBe(
      setup.organization.profileId,
    );
  });

  it('should return empty list when no decision profiles exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.listDecisionProfiles({
      limit: 10,
    });

    expect(result.items).toHaveLength(0);
    expect(result.next).toBeNull();
  });

  it('should only show profiles the user has access to', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Create a setup where the main user has access to 1 instance
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    // Create a different user who will own another instance
    const otherUser = await testData.createMemberUser({
      organization: setup.organization,
    });

    // Create an instance owned by the other user (so main user doesn't have access)
    const otherUserCaller = await createAuthenticatedCaller(otherUser.email);
    const otherUserInstance =
      await otherUserCaller.decision.createInstanceFromTemplate({
        templateId: setup.process.id,
        name: 'Other User Instance',
        description: 'Instance owned by other user',
      });
    // Track the profile for cleanup
    testData.trackProfileForCleanup(otherUserInstance.id);

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.listDecisionProfiles({
      limit: 10,
    });

    // Main user should only see the profile they have access to
    expect(result.items).toMatchObject([
      {
        id: setup.instances[0]?.profileId,
        processInstance: {
          id: setup.instances[0]?.instance.id,
        },
      },
    ]);
  });

  it('should properly paginate through all items', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Create 5 instances to test multi-page pagination
    const setup = await testData.createDecisionSetup({
      instanceCount: 5,
      grantAccess: true,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Collect all profile IDs across pages
    const allProfileIds: string[] = [];
    let cursor: string | undefined;
    let pageCount = 0;

    // Paginate through all pages with limit of 2
    do {
      const page = await caller.decision.listDecisionProfiles({
        limit: 2,
        cursor,
      });

      allProfileIds.push(...page.items.map((item) => item.id));
      cursor = page.next ?? undefined;
      pageCount++;

      // Safety check to prevent infinite loops
      if (pageCount > 10) {
        throw new Error('Too many pages - possible infinite loop');
      }
    } while (cursor);

    // Verify we got all 5 items
    expect(allProfileIds).toHaveLength(5);

    // Verify no duplicates
    const uniqueIds = new Set(allProfileIds);
    expect(uniqueIds.size).toBe(5);

    // Verify we needed 3 pages (2 + 2 + 1)
    expect(pageCount).toBe(3);
  });

  it('should paginate correctly when ordering by name', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: false,
    });

    // Create instances with specific names to control ordering
    const names = [
      'Echo',
      'Bravo',

      'Alpha',
      'Delta',

      'Zoisa',
      'Charlie',

      'Dave',
      'Mary',

      'Nea',
    ];
    for (const name of names) {
      const instance = await testData.createInstanceForProcess({
        process: setup.process,
        user: setup.user,
        name,
        budget: 50000,
      });
      await testData.grantProfileAccess(
        instance.profileId,
        setup.user.id,
        setup.userEmail,
      );
    }

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Collect all names across pages, ordered by name ascending
    const allNames: string[] = [];
    let cursor: string | undefined;
    let pageCount = 0;

    do {
      const page = await caller.decision.listDecisionProfiles({
        limit: 2,
        cursor,
        orderBy: 'name',
        dir: 'asc',
      });

      allNames.push(...page.items.map((item) => item.name));
      cursor = page.next ?? undefined;
      pageCount++;

      if (pageCount > 10) {
        throw new Error('Too many pages - possible infinite loop');
      }
    } while (cursor);

    // Verify we got all  items
    expect(allNames).toHaveLength(9);

    // Verify no duplicates
    const uniqueNames = new Set(allNames);
    expect(uniqueNames.size).toBe(9);

    // Verify correct alphabetical order
    const sortedNames = [...allNames].sort();
    expect(allNames).toEqual(sortedNames);

    expect(pageCount).toBe(5);
  });
});
