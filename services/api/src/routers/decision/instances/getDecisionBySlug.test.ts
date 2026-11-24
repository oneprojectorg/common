import type { ProposalTemplateSchema, SelectionPipeline } from '@op/common';
import { TestDecisionsDataManager } from '@op/common/testing';
import { db, eq } from '@op/db/client';
import { processPhases } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating/decision';
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

function expectNoIdsInInstanceData(phases: object[] | undefined) {
  expect(phases?.length).toBeGreaterThan(0);
  for (const phase of phases ?? []) {
    expect(phase).not.toHaveProperty('id');
    expect(phase).not.toHaveProperty('slug');
  }
}

describe.concurrent('getDecisionBySlug', () => {
  it('should return decision profile by slug', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const { slug, profileId } = setup.instance;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.getDecisionBySlug({ slug });

    expect(result.slug).toBe(slug);
    expect(result.type).toBe('decision');
    expect(result.id).toBe(profileId);
    expect(result.processInstance).toBeDefined();
    // The hot-path slug fetch intentionally skips proposal aggregates — list
    // views get counts from listDecisionProfiles.
    expect(result.processInstance.proposalCount).toBeUndefined();
    expect(result.processInstance.participantCount).toBeUndefined();
  });

  it('should throw error when user does not have access', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Create instance (creator has access by default via createInstanceFromTemplate)
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: false,
    });

    const { slug } = setup.instance;

    // Create a different user who doesn't have access to the instance
    const otherUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [], // Don't grant access to any instances
    });
    const caller = await createAuthenticatedCaller(otherUser.email);

    await expect(
      caller.decision.getDecisionBySlug({ slug }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError', statusCode: 403 },
    });
  });

  it('should throw error for non-existent slug', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.getDecisionBySlug({ slug: 'non-existent-slug' }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError', statusCode: 403 },
    });
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

    const { slug } = setup.instance;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.getDecisionBySlug({ slug });

    expect(result.processInstance.instanceData.templateId).toBeDefined();
    expect(result.processInstance.owner).toBeDefined();
    expect(result.processInstance.owner?.id).toBe(setup.organization.profileId);
  });

  it('reflects instance updates immediately (slug-snapshot cache invalidation)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const { slug } = setup.instance;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Warm the slug-keyed snapshot cache, then mutate: the mutation's
    // invalidateDecisionInstance must bust the snapshot so the next read
    // serves the new name, not the warm entry.
    const before = await caller.decision.getDecisionBySlug({ slug });
    expect(before.processInstance.name).not.toBeNull();

    const newName = `Renamed ${task.id}`;
    await caller.decision.updateDecisionInstance({
      instanceId: setup.instance.instance.id,
      name: newName,
    });

    const after = await caller.decision.getDecisionBySlug({ slug });
    expect(after.processInstance.name).toBe(newName);
  });

  it('returns each phase with its row id and profile slug, in order', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const storedPhases = await db.query.processPhases.findMany({
      where: { processInstanceId: setup.instance.instance.id },
      columns: { id: true },
      with: { profile: { columns: { name: true, slug: true } } },
      orderBy: { sortOrder: 'asc' },
    });
    await Promise.all(
      storedPhases.map(({ id }, index) =>
        db
          .update(processPhases)
          .set({ sortOrder: storedPhases.length - 1 - index })
          .where(eq(processPhases.id, id)),
      ),
    );

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.getDecisionBySlug({
      slug: setup.instance.slug,
    });

    expect(storedPhases.length).toBeGreaterThan(1);
    expect(
      result.processInstance.phases.map(({ id, slug, name }) => [
        id,
        slug,
        name,
      ]),
    ).toEqual(
      [...storedPhases]
        .reverse()
        .map(({ id, profile }) => [id, profile.slug, profile.name]),
    );
    expectNoIdsInInstanceData(result.processInstance.instanceData.phases);
  });

  it("returns each phase's whole selection pipeline and proposal template", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const selectionPipeline: SelectionPipeline = {
      version: '1.0.0',
      blocks: [
        {
          id: 'shortlisted',
          type: 'filter',
          condition: {
            operator: 'equals',
            left: { field: 'status' },
            right: { value: 'approved' },
          },
        },
      ],
    };
    const proposalTemplate: ProposalTemplateSchema = {
      type: 'object',
      properties: { title: { type: 'string' } },
    };
    await testData.leaveOnlyPhaseRows(setup.instance.instance.id, {
      selectionPipeline,
      proposalTemplate,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.getDecisionBySlug({
      slug: setup.instance.slug,
    });

    expect(result.processInstance.phases[0]).toMatchObject({
      selectionPipeline,
      proposalTemplate,
    });
  });

  it('returns a null id and slug for phases a decision has not stored yet', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    await testData.removePhaseRows(setup.instance.instance.id);

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.getDecisionBySlug({
      slug: setup.instance.slug,
    });

    expect(result.processInstance.phases.length).toBeGreaterThan(0);
    expect(
      result.processInstance.phases.map(({ id, slug, phaseId }) => [
        id,
        slug,
        phaseId,
      ]),
    ).toEqual(
      setup.instance.instance.instanceData.phases.map(({ phaseId }) => [
        null,
        null,
        phaseId,
      ]),
    );
    expectNoIdsInInstanceData(result.processInstance.instanceData.phases);
  });
});

describeDecisionAccessTierGating('getDecisionBySlug', {
  noJwtNonPublic: accessTierGatingCell(
    'admits no-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.noJwt();

      await expectPassesAccessTierGate(
        caller.decision.getDecisionBySlug({ slug: instance.slug }),
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'admits anon-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.anonJwt();

      await expectPassesAccessTierGate(
        caller.decision.getDecisionBySlug({ slug: instance.slug }),
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'admits user-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(
        caller.decision.getDecisionBySlug({ slug: instance.slug }),
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.networkJwt(setup.userEmail);

      await expectPassesAccessTierGate(
        caller.decision.getDecisionBySlug({ slug: instance.slug }),
      );
    },
  ),
});
