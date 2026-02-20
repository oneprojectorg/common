import { db, eq, inArray } from '@op/db/client';
import {
  organizationUsers,
  processInstances,
  taxonomies,
  taxonomyTerms,
} from '@op/db/schema';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

/**
 * Creates a "proposal" taxonomy with the given terms for testing.
 * Returns cleanup function and the created term records.
 */
async function seedProposalTaxonomy(
  termLabels: string[],
  onTestFinished: (fn: () => void | Promise<void>) => void,
) {
  const taxonomyId = randomUUID();

  // Use onConflictDoNothing since the "proposal" taxonomy may already exist
  // from a concurrent test. If it already exists, look up the existing one.
  const [inserted] = await db
    .insert(taxonomies)
    .values({ id: taxonomyId, name: 'proposal' })
    .onConflictDoNothing({ target: taxonomies.name })
    .returning({ id: taxonomies.id });

  let resolvedTaxonomyId: string;

  if (inserted) {
    resolvedTaxonomyId = inserted.id;
  } else {
    // Another test created it — look up the existing one
    const [existing] = await db
      .select({ id: taxonomies.id })
      .from(taxonomies)
      .where(eq(taxonomies.name, 'proposal'));
    if (!existing) {
      throw new Error('proposal taxonomy not found after conflict');
    }
    resolvedTaxonomyId = existing.id;
  }

  const termRecords = termLabels.map((label) => ({
    id: randomUUID(),
    taxonomyId: resolvedTaxonomyId,
    termUri: label
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, ''),
    label,
  }));

  if (termRecords.length > 0) {
    await db.insert(taxonomyTerms).values(termRecords);
  }

  onTestFinished(async () => {
    if (termRecords.length > 0) {
      await db.delete(taxonomyTerms).where(
        inArray(
          taxonomyTerms.id,
          termRecords.map((t) => t.id),
        ),
      );
    }
  });

  return { taxonomyId: resolvedTaxonomyId, termRecords };
}

/**
 * Injects config.categories into an existing process instance's instanceData.
 */
async function injectInstanceCategories(
  instanceId: string,
  categories: Array<{ id: string; label: string; description: string }>,
) {
  const [instance] = await db
    .select({ instanceData: processInstances.instanceData })
    .from(processInstances)
    .where(eq(processInstances.id, instanceId));

  if (!instance) {
    throw new Error(`Instance ${instanceId} not found`);
  }

  const instanceData = instance.instanceData as Record<string, unknown>;
  await db
    .update(processInstances)
    .set({
      instanceData: {
        ...instanceData,
        config: {
          ...((instanceData.config as Record<string, unknown>) ?? {}),
          categories,
        },
      },
    })
    .where(eq(processInstances.id, instanceId));
}

describe.concurrent('getCategories permissions', () => {
  it('should allow access for a user with profile-level permissions', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.getCategories({
      processInstanceId: instance.instance.id,
    });

    expect(result.categories).toEqual([]);
  });

  it('should allow access for a member with profile-level permissions', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const memberCaller = await createAuthenticatedCaller(memberUser.email);

    const result = await memberCaller.decision.getCategories({
      processInstanceId: instance.instance.id,
    });

    expect(result.categories).toEqual([]);
  });

  it('should allow access via org-level fallback when user lacks profile access', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: false,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    // The admin user has org-level access (created the org) but no profile-level
    // access on the instance (grantAccess: false). The org fallback should allow access.
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.getCategories({
      processInstanceId: instance.instance.id,
    });

    expect(result.categories).toEqual([]);
  });

  it('should deny access for a user with no profile or org access', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    // Create a member user with no instance profile access
    const outsiderUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });

    // Remove the user from the organization so they have no org-level fallback
    await db
      .delete(organizationUsers)
      .where(eq(organizationUsers.authUserId, outsiderUser.authUserId));

    const unauthorizedCaller = await createAuthenticatedCaller(
      outsiderUser.email,
    );

    await expect(
      unauthorizedCaller.decision.getCategories({
        processInstanceId: instance.instance.id,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('should allow access via org member role fallback when user has no profile access', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    // Create a member with org access but no instance profile access
    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });

    const memberCaller = await createAuthenticatedCaller(memberUser.email);

    // Member role at org level has decisions READ permission,
    // so this should succeed via org fallback
    const result = await memberCaller.decision.getCategories({
      processInstanceId: instance.instance.id,
    });

    expect(result.categories).toEqual([]);
  });
});

describe.concurrent('getCategories category matching', () => {
  it('should return matched categories when config.categories and taxonomy terms exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    // Use unique labels per test to avoid (taxonomyId, termUri) unique constraint
    // collisions when tests run concurrently against the shared "proposal" taxonomy
    const { termRecords } = await seedProposalTaxonomy(
      ['Renewable Energy', 'Food Security'],
      onTestFinished,
    );

    await injectInstanceCategories(instance.instance.id, [
      {
        id: 'cat-1',
        label: 'Renewable Energy',
        description: 'Renewable energy proposals',
      },
      {
        id: 'cat-2',
        label: 'Food Security',
        description: 'Food security proposals',
      },
    ]);

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.getCategories({
      processInstanceId: instance.instance.id,
    });

    expect(result.categories).toHaveLength(2);
    expect(result.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: termRecords[0]!.id,
          name: 'Renewable Energy',
          termUri: 'renewable-energy',
        }),
        expect.objectContaining({
          id: termRecords[1]!.id,
          name: 'Food Security',
          termUri: 'food-security',
        }),
      ]),
    );
  });

  it('should only return categories that match taxonomy terms (partial match)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    // Only seed one matching term — "Water Access" exists but "Nonexistent" does not
    const { termRecords } = await seedProposalTaxonomy(
      ['Water Access'],
      onTestFinished,
    );

    await injectInstanceCategories(instance.instance.id, [
      {
        id: 'cat-1',
        label: 'Nonexistent Category',
        description: 'No matching taxonomy term',
      },
      {
        id: 'cat-2',
        label: 'Water Access',
        description: 'Water access proposals',
      },
    ]);

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.getCategories({
      processInstanceId: instance.instance.id,
    });

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0]).toEqual(
      expect.objectContaining({
        id: termRecords[0]!.id,
        name: 'Water Access',
        termUri: 'water-access',
      }),
    );
  });

  it('should return empty array when instance has no config.categories', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    // Seed taxonomy so we can confirm it's not about missing taxonomy
    await seedProposalTaxonomy(['Digital Literacy'], onTestFinished);

    // Don't inject any categories — instanceData has no config.categories

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.getCategories({
      processInstanceId: instance.instance.id,
    });

    expect(result.categories).toEqual([]);
  });

  it('should return empty array when no categories match any taxonomy terms', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    // Seed taxonomy with terms that won't match our categories
    await seedProposalTaxonomy(['Urban Planning'], onTestFinished);

    await injectInstanceCategories(instance.instance.id, [
      {
        id: 'cat-1',
        label: 'Completely Different Category',
        description: 'No matching taxonomy term exists',
      },
    ]);

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.getCategories({
      processInstanceId: instance.instance.id,
    });

    expect(result.categories).toEqual([]);
  });

  it('should handle special characters in category labels via termUri conversion', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    // The termUri for "Health & Wellness" after conversion:
    // "health & wellness" -> "health--wellness" (& removed, spaces become -)
    const { termRecords } = await seedProposalTaxonomy(
      ['Health & Wellness'],
      onTestFinished,
    );
    const expectedTermUri = 'health--wellness';

    await injectInstanceCategories(instance.instance.id, [
      {
        id: 'cat-1',
        label: 'Health & Wellness',
        description: 'Health and wellness proposals',
      },
    ]);

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.getCategories({
      processInstanceId: instance.instance.id,
    });

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0]).toEqual(
      expect.objectContaining({
        id: termRecords[0]!.id,
        name: 'Health & Wellness',
        termUri: expectedTermUri,
      }),
    );
  });
});
